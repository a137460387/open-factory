import { useState, useCallback, useRef, useEffect } from 'react';
import type { SpeakerDiarizationResult } from '@open-factory/editor-core/ai/speaker-diarization';
import { getSpeakerBasedAngleSwitches } from '@open-factory/editor-core/ai/speaker-diarization';

/** 说话人-机位映射 */
export interface SpeakerAngleMapping {
  /** 说话人ID */
  speakerId: number;
  /** 说话人标签 */
  speakerLabel: string;
  /** 对应的机位索引 */
  angleIndex: number;
  /** 机位名称 */
  angleName?: string;
}

/** 自动切换配置 */
export interface AutoSwitchConfig {
  /** 是否启用自动切换 */
  enabled: boolean;
  /** 最小切换间隔（毫秒） */
  minSwitchIntervalMs: number;
  /** 切换过渡类型 */
  transitionType: 'cut' | 'dissolve' | 'wipe';
  /** 过渡时长（毫秒，仅dissolve和wipe） */
  transitionDurationMs?: number;
}

/** 切换建议 */
export interface SwitchSuggestion {
  /** 切换时间（毫秒） */
  timeMs: number;
  /** 目标机位 */
  targetAngle: number;
  /** 说话人ID */
  speakerId: number;
  /** 说话人标签 */
  speakerLabel: string;
  /** 置信度 */
  confidence: number;
}

/** 集成状态 */
export interface SpeakerMulticamState {
  /** 说话人-机位映射 */
  mappings: SpeakerAngleMapping[];
  /** 自动切换配置 */
  config: AutoSwitchConfig;
  /** 切换建议列表 */
  suggestions: SwitchSuggestion[];
  /** 是否正在处理 */
  isProcessing: boolean;
  /** 错误信息 */
  error: string | null;
}

/** 默认配置 */
const DEFAULT_CONFIG: AutoSwitchConfig = {
  enabled: false,
  minSwitchIntervalMs: 1500,
  transitionType: 'cut',
  transitionDurationMs: 300,
};

/**
 * 说话人-多机位集成 Hook
 */
export function useSpeakerMulticam() {
  const [state, setState] = useState<SpeakerMulticamState>({
    mappings: [],
    config: DEFAULT_CONFIG,
    suggestions: [],
    isProcessing: false,
    error: null,
  });

  /**
   * 设置说话人-机位映射
   */
  const setMapping = useCallback((speakerId: number, angleIndex: number, angleName?: string) => {
    setState(prev => {
      const existingIndex = prev.mappings.findIndex(m => m.speakerId === speakerId);
      const newMappings = [...prev.mappings];

      if (existingIndex >= 0) {
        newMappings[existingIndex] = {
          ...newMappings[existingIndex],
          angleIndex,
          angleName,
        };
      } else {
        newMappings.push({
          speakerId,
          speakerLabel: `说话人 ${String.fromCharCode(65 + speakerId)}`,
          angleIndex,
          angleName,
        });
      }

      return { ...prev, mappings: newMappings };
    });
  }, []);

  /**
   * 移除说话人-机位映射
   */
  const removeMapping = useCallback((speakerId: number) => {
    setState(prev => ({
      ...prev,
      mappings: prev.mappings.filter(m => m.speakerId !== speakerId),
    }));
  }, []);

  /**
   * 更新自动切换配置
   */
  const updateConfig = useCallback((config: Partial<AutoSwitchConfig>) => {
    setState(prev => ({
      ...prev,
      config: { ...prev.config, ...config },
    }));
  }, []);

  /**
   * 基于说话人分离结果生成切换建议
   */
  const generateSuggestions = useCallback((
    diarizationResult: SpeakerDiarizationResult,
    mappings?: SpeakerAngleMapping[],
  ) => {
    const currentMappings = mappings ?? state.mappings;

    if (currentMappings.length === 0) {
      setState(prev => ({
        ...prev,
        suggestions: [],
        error: '未配置说话人-机位映射',
      }));
      return [];
    }

    setState(prev => ({ ...prev, isProcessing: true, error: null }));

    try {
      // 构建映射表
      const speakerAngleMap = new Map<number, number>();
      for (const mapping of currentMappings) {
        speakerAngleMap.set(mapping.speakerId, mapping.angleIndex);
      }

      // 获取切换建议
      const switches = getSpeakerBasedAngleSwitches(
        diarizationResult.segments,
        speakerAngleMap,
        state.config.minSwitchIntervalMs,
      );

      // 转换为完整的切换建议
      const suggestions: SwitchSuggestion[] = switches.map(sw => {
        const mapping = currentMappings.find(m => m.speakerId === sw.speakerId);
        const segment = diarizationResult.segments.find(
          s => s.speakerId === sw.speakerId && s.startMs <= sw.timeMs && s.endMs > sw.timeMs
        );

        return {
          timeMs: sw.timeMs,
          targetAngle: sw.targetAngle,
          speakerId: sw.speakerId,
          speakerLabel: mapping?.speakerLabel ?? `说话人 ${String.fromCharCode(65 + sw.speakerId)}`,
          confidence: segment?.confidence ?? 0.8,
        };
      });

      setState(prev => ({
        ...prev,
        suggestions,
        isProcessing: false,
      }));

      return suggestions;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '生成切换建议失败';
      setState(prev => ({
        ...prev,
        isProcessing: false,
        error: errorMessage,
      }));
      return [];
    }
  }, [state.mappings, state.config.minSwitchIntervalMs]);

  /**
   * 应用切换建议到多机位序列
   */
  const applySuggestions = useCallback((
    suggestions: SwitchSuggestion[],
    onApply: (switches: Array<{ timeMs: number; targetAngle: number }>) => void,
  ) => {
    if (suggestions.length === 0) return;

    const switches = suggestions.map(s => ({
      timeMs: s.timeMs,
      targetAngle: s.targetAngle,
    }));

    onApply(switches);
  }, []);

  /**
   * 清除切换建议
   */
  const clearSuggestions = useCallback(() => {
    setState(prev => ({ ...prev, suggestions: [] }));
  }, []);

  /**
   * 自动配置映射（基于检测到的说话人）
   */
  const autoConfigureMappings = useCallback((
    diarizationResult: SpeakerDiarizationResult,
    availableAngles: Array<{ index: number; name: string }>,
  ) => {
    const mappings: SpeakerAngleMapping[] = [];

    // 为每个检测到的说话人分配机位
    diarizationResult.speakers.forEach((speaker, index) => {
      if (index < availableAngles.length) {
        mappings.push({
          speakerId: speaker.speakerId,
          speakerLabel: speaker.speakerLabel,
          angleIndex: availableAngles[index].index,
          angleName: availableAngles[index].name,
        });
      }
    });

    setState(prev => ({ ...prev, mappings }));
    return mappings;
  }, []);

  /**
   * 重置状态
   */
  const reset = useCallback(() => {
    setState({
      mappings: [],
      config: DEFAULT_CONFIG,
      suggestions: [],
      isProcessing: false,
      error: null,
    });
  }, []);

  return {
    state,
    setMapping,
    removeMapping,
    updateConfig,
    generateSuggestions,
    applySuggestions,
    clearSuggestions,
    autoConfigureMappings,
    reset,
  };
}
