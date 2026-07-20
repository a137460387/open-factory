import { create } from 'zustand';
import type {
  MixerChannel,
  MixerState,
  AudioBus,
  AudioEffectSlot,
  AutomationCurve,
  AudioFollowMode,
  MulticamAudioGroup,
} from '@open-factory/editor-core';
import {
  createDefaultMixerState,
  createMixerChannel,
  createBus,
  createEffectSlot,
  EffectChainEngine,
  buildNoiseReductionFilterString,
  createMulticamAudioGroup,
  updateGroupActiveAngle,
  setGroupFollowMode,
  updateChannelVolume as updateMcChannelVolume,
  toggleChannelMute as toggleMcChannelMute,
  setGroupMasterVolume as setMcGroupMasterVolume,
} from '@open-factory/editor-core';
import type { NoiseReductionParams } from '@open-factory/editor-core';

/** 混音器 UI 面板标签 */
export type MixerPanelTab = 'mix' | 'effects' | 'automation' | 'spectrum' | 'analysis';

/** 混音器 Store 状态 */
export interface MixerStoreState {
  /** 混音器核心状态 */
  mixerState: MixerState;
  /** 当前选中的通道 trackId */
  selectedChannelId: string | null;
  /** 当前展开的通道 ID 集合 */
  expandedChannelIds: Set<string>;
  /** 当前激活的面板标签 */
  activeTab: MixerPanelTab;
  /** 降噪参数（按 trackId 索引） */
  noiseReductionParams: Record<string, NoiseReductionParams>;
  /** 降噪预览中的 trackId */
  noiseReductionPreviewTrackId: string | null;
  /** 频谱分析器是否激活 */
  spectrumAnalyzerActive: boolean;
  /** 自动化录制模式 */
  automationRecordMode: 'read' | 'write' | 'touch' | 'latch';

  /** 多机位音频组 */
  multicamAudioGroups: MulticamAudioGroup[];

  // ─── Actions ──────────────────────────────────────────────

  /** 从项目 tracks 初始化混音器通道 */
  initChannels: (tracks: Array<{ id: string; name: string; type: string }>) => void;

  /** 设置通道音量 */
  setChannelVolume: (trackId: string, volume: number) => void;

  /** 设置通道声像 */
  setChannelPan: (trackId: string, pan: number) => void;

  /** 切换通道静音 */
  toggleChannelMute: (trackId: string) => void;

  /** 切换通道独奏 */
  toggleChannelSolo: (trackId: string) => void;

  /** 更新通道效果链 */
  updateChannelEffects: (trackId: string, effects: AudioEffectSlot[]) => void;

  /** 添加效果到通道 */
  addEffectToChannel: (trackId: string, effectType: string) => void;

  /** 从通道移除效果 */
  removeEffectFromChannel: (trackId: string, effectId: string) => void;

  /** 更新通道自动化曲线 */
  updateChannelAutomation: (trackId: string, property: string, curve: AutomationCurve) => void;

  /** 设置 Master 音量 */
  setMasterVolume: (volume: number) => void;

  /** 设置 Master 声像 */
  setMasterPan: (pan: number) => void;

  /** 切换 Master 静音 */
  toggleMasterMute: () => void;

  /** 添加总线 */
  addBus: (name: string, type: 'submix' | 'send' | 'aux') => void;

  /** 删除总线 */
  removeBus: (busId: string) => void;

  /** 更新总线参数 */
  updateBus: (busId: string, patch: Partial<AudioBus>) => void;

  /** 选中通道 */
  selectChannel: (trackId: string | null) => void;

  /** 展开/折叠通道 */
  toggleChannelExpanded: (trackId: string) => void;

  /** 设置活跃面板标签 */
  setActiveTab: (tab: MixerPanelTab) => void;

  /** 设置降噪参数 */
  setNoiseReductionParams: (trackId: string, params: NoiseReductionParams) => void;

  /** 设置降噪预览通道 */
  setNoiseReductionPreviewTrackId: (trackId: string | null) => void;

  /** 切换频谱分析器 */
  toggleSpectrumAnalyzer: () => void;

  /** 设置自动化录制模式 */
  setAutomationRecordMode: (mode: 'read' | 'write' | 'touch' | 'latch') => void;

  /** 添加多机位音频组 */
  addMulticamAudioGroup: (
    groupId: string,
    name: string,
    angles: Array<{ id: string; mediaId: string; name: string }>,
    followMode?: AudioFollowMode,
  ) => void;

  /** 删除多机位音频组 */
  removeMulticamAudioGroup: (groupId: string) => void;

  /** 更新多机位音频组的激活机位 */
  updateMulticamGroupActiveAngle: (groupId: string, activeAngleIndex: number) => void;

  /** 设置多机位音频组的跟随模式 */
  setMulticamGroupFollowMode: (groupId: string, mode: AudioFollowMode) => void;

  /** 更新多机位音频组内通道音量 */
  updateMulticamChannelVolume: (groupId: string, channelId: string, volume: number) => void;

  /** 切换多机位音频组内通道静音 */
  toggleMulticamChannelMute: (groupId: string, channelId: string) => void;

  /** 设置多机位音频组主音量 */
  setMulticamGroupMasterVolume: (groupId: string, volume: number) => void;

  /** 重置混音器状态 */
  reset: () => void;
}

/** 仅状态属性（不含 action 方法） */
type MixerStateOnly = Omit<
  MixerStoreState,
  | 'initChannels'
  | 'setChannelVolume'
  | 'setChannelPan'
  | 'toggleChannelMute'
  | 'toggleChannelSolo'
  | 'updateChannelEffects'
  | 'addEffectToChannel'
  | 'removeEffectFromChannel'
  | 'updateChannelAutomation'
  | 'setMasterVolume'
  | 'setMasterPan'
  | 'toggleMasterMute'
  | 'addBus'
  | 'removeBus'
  | 'updateBus'
  | 'selectChannel'
  | 'toggleChannelExpanded'
  | 'setActiveTab'
  | 'setNoiseReductionParams'
  | 'setNoiseReductionPreviewTrackId'
  | 'toggleSpectrumAnalyzer'
  | 'setAutomationRecordMode'
  | 'addMulticamAudioGroup'
  | 'removeMulticamAudioGroup'
  | 'updateMulticamGroupActiveAngle'
  | 'setMulticamGroupFollowMode'
  | 'updateMulticamChannelVolume'
  | 'toggleMulticamChannelMute'
  | 'setMulticamGroupMasterVolume'
  | 'reset'
>;

const initialState: MixerStateOnly = {
  mixerState: createDefaultMixerState(),
  selectedChannelId: null,
  expandedChannelIds: new Set(),
  activeTab: 'mix',
  noiseReductionParams: {},
  noiseReductionPreviewTrackId: null,
  spectrumAnalyzerActive: false,
  automationRecordMode: 'read',
  multicamAudioGroups: [],
};

export const useMixerStore = create<MixerStoreState>((set, get) => ({
  ...initialState,

  initChannels: (tracks) => {
    const channels = tracks
      .filter((t) => t.type === 'audio' || t.type === 'video')
      .map((t) => createMixerChannel(t.id, t.name));
    set((state) => ({
      mixerState: { ...state.mixerState, channels },
    }));
  },

  setChannelVolume: (trackId, volume) => {
    set((state) => ({
      mixerState: {
        ...state.mixerState,
        channels: state.mixerState.channels.map((ch) =>
          ch.trackId === trackId ? { ...ch, volume: Math.max(-60, Math.min(12, volume)) } : ch,
        ),
      },
    }));
  },

  setChannelPan: (trackId, pan) => {
    set((state) => ({
      mixerState: {
        ...state.mixerState,
        channels: state.mixerState.channels.map((ch) =>
          ch.trackId === trackId ? { ...ch, pan: Math.max(-100, Math.min(100, pan)) } : ch,
        ),
      },
    }));
  },

  toggleChannelMute: (trackId) => {
    set((state) => ({
      mixerState: {
        ...state.mixerState,
        channels: state.mixerState.channels.map((ch) => (ch.trackId === trackId ? { ...ch, muted: !ch.muted } : ch)),
      },
    }));
  },

  toggleChannelSolo: (trackId) => {
    set((state) => ({
      mixerState: {
        ...state.mixerState,
        channels: state.mixerState.channels.map((ch) => (ch.trackId === trackId ? { ...ch, solo: !ch.solo } : ch)),
      },
    }));
  },

  updateChannelEffects: (trackId, effects) => {
    set((state) => ({
      mixerState: {
        ...state.mixerState,
        channels: state.mixerState.channels.map((ch) =>
          ch.trackId === trackId ? { ...ch, effectsChain: effects } : ch,
        ),
      },
    }));
  },

  addEffectToChannel: (trackId, effectType) => {
    const state = get();
    const channel = state.mixerState.channels.find((ch) => ch.trackId === trackId);
    if (!channel) return;
    const newEffect = createEffectSlot(effectType as any);
    newEffect.order = channel.effectsChain.length;
    set((prev) => ({
      mixerState: {
        ...prev.mixerState,
        channels: prev.mixerState.channels.map((ch) =>
          ch.trackId === trackId ? { ...ch, effectsChain: [...ch.effectsChain, newEffect] } : ch,
        ),
      },
    }));
  },

  removeEffectFromChannel: (trackId, effectId) => {
    set((state) => ({
      mixerState: {
        ...state.mixerState,
        channels: state.mixerState.channels.map((ch) =>
          ch.trackId === trackId
            ? {
                ...ch,
                effectsChain: ch.effectsChain.filter((e) => e.id !== effectId).map((e, i) => ({ ...e, order: i })),
              }
            : ch,
        ),
      },
    }));
  },

  updateChannelAutomation: (trackId, property, curve) => {
    set((state) => ({
      mixerState: {
        ...state.mixerState,
        channels: state.mixerState.channels.map((ch) =>
          ch.trackId === trackId ? { ...ch, automation: { ...ch.automation, [property]: curve } } : ch,
        ),
      },
    }));
  },

  setMasterVolume: (volume) => {
    set((state) => ({
      mixerState: {
        ...state.mixerState,
        masterBus: { ...state.mixerState.masterBus, volume: Math.max(-60, Math.min(12, volume)) },
      },
    }));
  },

  setMasterPan: (pan) => {
    set((state) => ({
      mixerState: {
        ...state.mixerState,
        masterBus: { ...state.mixerState.masterBus, pan: Math.max(-100, Math.min(100, pan)) },
      },
    }));
  },

  toggleMasterMute: () => {
    set((state) => ({
      mixerState: {
        ...state.mixerState,
        masterBus: { ...state.mixerState.masterBus, muted: !state.mixerState.masterBus.muted },
      },
    }));
  },

  addBus: (name, type) => {
    const newBus = createBus(name, type);
    set((state) => ({
      mixerState: {
        ...state.mixerState,
        buses: [...state.mixerState.buses, newBus],
      },
    }));
  },

  removeBus: (busId) => {
    set((state) => ({
      mixerState: {
        ...state.mixerState,
        buses: state.mixerState.buses.filter((b) => b.id !== busId),
        channels: state.mixerState.channels.map((ch) => ({
          ...ch,
          busAssignments: ch.busAssignments.filter((a) => a.busId !== busId),
        })),
      },
    }));
  },

  updateBus: (busId, patch) => {
    set((state) => ({
      mixerState: {
        ...state.mixerState,
        buses: state.mixerState.buses.map((b) => (b.id === busId ? { ...b, ...patch } : b)),
      },
    }));
  },

  selectChannel: (trackId) => set({ selectedChannelId: trackId }),

  toggleChannelExpanded: (trackId) => {
    set((state) => {
      const next = new Set(state.expandedChannelIds);
      if (next.has(trackId)) {
        next.delete(trackId);
      } else {
        next.add(trackId);
      }
      return { expandedChannelIds: next };
    });
  },

  setActiveTab: (tab) => set({ activeTab: tab }),

  setNoiseReductionParams: (trackId, params) => {
    set((state) => ({
      noiseReductionParams: { ...state.noiseReductionParams, [trackId]: params },
    }));
  },

  setNoiseReductionPreviewTrackId: (trackId) => {
    set({ noiseReductionPreviewTrackId: trackId });
  },

  toggleSpectrumAnalyzer: () => {
    set((state) => ({ spectrumAnalyzerActive: !state.spectrumAnalyzerActive }));
  },

  setAutomationRecordMode: (mode) => set({ automationRecordMode: mode }),

  addMulticamAudioGroup: (groupId, name, angles, followMode) => {
    const group = createMulticamAudioGroup(groupId, name, angles, followMode);
    set((state) => ({
      multicamAudioGroups: [...state.multicamAudioGroups, group],
    }));
  },

  removeMulticamAudioGroup: (groupId) => {
    set((state) => ({
      multicamAudioGroups: state.multicamAudioGroups.filter((g) => g.id !== groupId),
    }));
  },

  updateMulticamGroupActiveAngle: (groupId, activeAngleIndex) => {
    set((state) => ({
      multicamAudioGroups: state.multicamAudioGroups.map((g) =>
        g.id === groupId ? updateGroupActiveAngle(g, activeAngleIndex) : g,
      ),
    }));
  },

  setMulticamGroupFollowMode: (groupId, mode) => {
    set((state) => ({
      multicamAudioGroups: state.multicamAudioGroups.map((g) => (g.id === groupId ? setGroupFollowMode(g, mode) : g)),
    }));
  },

  updateMulticamChannelVolume: (groupId, channelId, volume) => {
    set((state) => ({
      multicamAudioGroups: state.multicamAudioGroups.map((g) =>
        g.id === groupId ? updateMcChannelVolume(g, channelId, volume) : g,
      ),
    }));
  },

  toggleMulticamChannelMute: (groupId, channelId) => {
    set((state) => ({
      multicamAudioGroups: state.multicamAudioGroups.map((g) =>
        g.id === groupId ? toggleMcChannelMute(g, channelId) : g,
      ),
    }));
  },

  setMulticamGroupMasterVolume: (groupId, volume) => {
    set((state) => ({
      multicamAudioGroups: state.multicamAudioGroups.map((g) =>
        g.id === groupId ? setMcGroupMasterVolume(g, volume) : g,
      ),
    }));
  },

  reset: () => set(initialState),
}));

// ─── Selector Hooks ───────────────────────────────────────────

/** 获取混音器状态 */
export const useMixerState = () => useMixerStore((s) => s.mixerState);

/** 获取所有通道 */
export const useMixerChannels = () => useMixerStore((s) => s.mixerState.channels);

/** 获取 Master 总线 */
export const useMasterBus = () => useMixerStore((s) => s.mixerState.masterBus);

/** 获取选中的通道 ID */
export const useSelectedChannelId = () => useMixerStore((s) => s.selectedChannelId);

/** 获取当前活跃标签 */
export const useActiveMixerTab = () => useMixerStore((s) => s.activeTab);

/** 获取频谱分析器状态 */
export const useSpectrumAnalyzerActive = () => useMixerStore((s) => s.spectrumAnalyzerActive);

/** 获取自动化录制模式 */
export const useAutomationRecordMode = () => useMixerStore((s) => s.automationRecordMode);

/** 获取指定通道的降噪参数 */
export const useChannelNoiseReduction = (trackId: string) => useMixerStore((s) => s.noiseReductionParams[trackId]);

/** 获取降噪预览通道 ID */
export const useNoiseReductionPreviewTrackId = () => useMixerStore((s) => s.noiseReductionPreviewTrackId);

/**
 * 获取所有通道的降噪参数（用于导出管线）
 * 返回 Record<trackId, NoiseReductionParams> 格式
 */
export function getNoiseReductionParamsForExport(): Record<string, NoiseReductionParams> {
  return useMixerStore.getState().noiseReductionParams;
}

/**
 * 获取指定通道的降噪滤镜字符串（用于导出管线）
 * 如果通道没有降噪参数，返回空字符串
 */
export function getChannelNoiseReductionFilter(trackId: string): string {
  const params = useMixerStore.getState().noiseReductionParams[trackId];
  if (!params) return '';
  return buildNoiseReductionFilterString(params);
}

/** 获取所有多机位音频组 */
export const useMulticamAudioGroups = () => useMixerStore((s) => s.multicamAudioGroups);

/** 获取指定多机位音频组 */
export const useMulticamAudioGroup = (groupId: string) =>
  useMixerStore((s) => s.multicamAudioGroups.find((g) => g.id === groupId));
