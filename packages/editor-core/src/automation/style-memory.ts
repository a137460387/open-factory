/**
 * 个人风格记忆库
 * 监听用户对自动生成序列的修改操作，将偏好转化为可复用的权重参数
 * 本地优先：所有数据存储在本地
 */

import type { TransitionType } from '../model-types';

// ============================================================
// 类型定义
// ============================================================

/** 修改操作类型 */
export type ModificationType =
  | 'clip-duration-adjust' // 片段时长调整
  | 'clip-reorder' // 片段重排序
  | 'clip-remove' // 片段删除
  | 'transition-change' // 转场替换
  | 'transition-duration' // 转场时长调整
  | 'volume-adjust' // 音量调整
  | 'trim-adjust' // 裁剪调整
  | 'speed-change' // 速度调整
  | 'color-adjust'; // 色彩调整

/** 修改记录 */
export interface ModificationRecord {
  id: string;
  /** 修改类型 */
  type: ModificationType;
  /** 修改时间戳 */
  timestamp: number;
  /** 模板 ID（关联的模板） */
  templateId: string;
  /** 原始值 */
  before: Record<string, unknown>;
  /** 修改后的值 */
  after: Record<string, unknown>;
  /** 关联的场景类型 */
  sceneType?: string;
  /** 关联的媒体路径 */
  mediaPath?: string;
}

/** 偏好权重 */
export interface PreferenceWeights {
  /** 片段时长偏好：负值偏好更短，正值偏好更长 */
  clipDurationBias: number;
  /** 转场类型偏好 */
  transitionPreference: Partial<Record<TransitionType, number>>;
  /** 转场时长偏好（秒） */
  preferredTransitionDuration: number;
  /** 节奏偏好：-1 慢节奏，0 中等，1 快节奏 */
  pacePreference: number;
  /** 场景类型权重调整 */
  sceneTypeWeights: Record<string, number>;
  /** 质量阈值偏好 */
  qualityThresholdAdjust: number;
  /** 样本数量（用于置信度评估） */
  sampleCount: number;
}

/** 风格配置文件 */
export interface StyleProfile {
  id: string;
  /** 配置文件名称 */
  name: string;
  /** 创建时间 */
  createdAt: number;
  /** 更新时间 */
  updatedAt: number;
  /** 修改记录 */
  records: ModificationRecord[];
  /** 计算出的偏好权重 */
  weights: PreferenceWeights;
  /** 关联的模板 ID */
  templateId?: string;
}

/** 风格记忆配置 */
export interface StyleMemoryConfig {
  /** 最大记录数（每个配置文件） */
  maxRecordsPerProfile: number;
  /** 最大配置文件数 */
  maxProfiles: number;
  /** 存储键名 */
  storageKey: string;
  /** 最小样本数，低于此数时权重不生效 */
  minSampleCount: number;
}

// ============================================================
// 工厂函数
// ============================================================

let _recordId = 1;
let _profileId = 1;

function genRecordId(): string {
  return `mod_${Date.now()}_${_recordId++}`;
}

function genProfileId(): string {
  return `style_${Date.now()}_${_profileId++}`;
}

/** 创建默认偏好权重 */
export function createDefaultPreferenceWeights(): PreferenceWeights {
  return {
    clipDurationBias: 0,
    transitionPreference: {},
    preferredTransitionDuration: 0.5,
    pacePreference: 0,
    sceneTypeWeights: {},
    qualityThresholdAdjust: 0,
    sampleCount: 0,
  };
}

/** 创建默认风格记忆配置 */
export function createDefaultStyleMemoryConfig(): StyleMemoryConfig {
  return {
    maxRecordsPerProfile: 500,
    maxProfiles: 10,
    storageKey: 'open-factory-style-memory',
    minSampleCount: 5,
  };
}

/** 创建空的风格配置文件 */
export function createEmptyStyleProfile(name: string, templateId?: string): StyleProfile {
  const now = Date.now();
  return {
    id: genProfileId(),
    name,
    createdAt: now,
    updatedAt: now,
    records: [],
    weights: createDefaultPreferenceWeights(),
    templateId,
  };
}

// ============================================================
// 偏好计算引擎
// ============================================================

/**
 * 从修改记录计算偏好权重
 * 基于统计分析用户行为模式
 */
export function calculateWeights(records: ModificationRecord[]): PreferenceWeights {
  if (records.length === 0) {
    return createDefaultPreferenceWeights();
  }

  const weights = createDefaultPreferenceWeights();
  weights.sampleCount = records.length;

  // 时长调整统计
  const durationAdjusts = records.filter((r) => r.type === 'clip-duration-adjust');
  if (durationAdjusts.length > 0) {
    let totalBias = 0;
    for (const r of durationAdjusts) {
      const before = Number(r.before.duration ?? 0);
      const after = Number(r.after.duration ?? 0);
      if (before > 0) {
        // 正值 = 用户倾向于更长，负值 = 更短
        totalBias += (after - before) / before;
      }
    }
    weights.clipDurationBias = clamp(totalBias / durationAdjusts.length, -1, 1);
  }

  // 转场偏好统计
  const transChanges = records.filter((r) => r.type === 'transition-change');
  for (const r of transChanges) {
    const toType = String(r.after.type ?? '') as TransitionType;
    if (toType) {
      weights.transitionPreference[toType] = (weights.transitionPreference[toType] ?? 0) + 1;
    }
  }
  // 归一化转场偏好
  const transTotal = Object.values(weights.transitionPreference).reduce((a, b) => a + b, 0);
  if (transTotal > 0) {
    for (const key of Object.keys(weights.transitionPreference)) {
      weights.transitionPreference[key as TransitionType]! /= transTotal;
    }
  }

  // 转场时长偏好
  const transDurations = records.filter((r) => r.type === 'transition-duration');
  if (transDurations.length > 0) {
    let totalDur = 0;
    for (const r of transDurations) {
      totalDur += Number(r.after.duration ?? 0.5);
    }
    weights.preferredTransitionDuration = totalDur / transDurations.length;
  }

  // 节奏偏好：通过速度调整推断
  const speedChanges = records.filter((r) => r.type === 'speed-change');
  if (speedChanges.length > 0) {
    let totalPace = 0;
    for (const r of speedChanges) {
      const speed = Number(r.after.speed ?? 1);
      // speed > 1 偏快，< 1 偏慢
      totalPace += clamp(speed - 1, -1, 1);
    }
    weights.pacePreference = clamp(totalPace / speedChanges.length, -1, 1);
  }

  // 场景类型权重调整：用户删除了哪些场景类型的片段
  const removedClips = records.filter((r) => r.type === 'clip-remove');
  for (const r of removedClips) {
    const sceneType = r.sceneType;
    if (sceneType) {
      weights.sceneTypeWeights[sceneType] = (weights.sceneTypeWeights[sceneType] ?? 0) - 1;
    }
  }
  // 用户重排序的片段对应的场景类型获得正权重
  const reorderedClips = records.filter((r) => r.type === 'clip-reorder');
  for (const r of reorderedClips) {
    const sceneType = r.sceneType;
    if (sceneType) {
      weights.sceneTypeWeights[sceneType] = (weights.sceneTypeWeights[sceneType] ?? 0) + 0.5;
    }
  }
  // 归一化场景类型权重到 [-1, 1]
  const maxSceneWeight = Math.max(1, ...Object.values(weights.sceneTypeWeights).map(Math.abs));
  for (const key of Object.keys(weights.sceneTypeWeights)) {
    weights.sceneTypeWeights[key] /= maxSceneWeight;
  }

  // 质量阈值调整：如果用户频繁删除低质量片段，说明对质量要求更高
  const removedQualities = removedClips.map((r) => Number(r.before.quality ?? 50)).filter((q) => q > 0);
  if (removedQualities.length > 0) {
    const avgRemovedQuality = removedQualities.reduce((a, b) => a + b, 0) / removedQualities.length;
    // 如果平均删除的质量分 > 50，说明用户对质量要求高
    weights.qualityThresholdAdjust = clamp((avgRemovedQuality - 50) / 50, -1, 1);
  }

  return weights;
}

/**
 * 将偏好权重应用到模板参数
 * 返回调整后的参数（不修改原模板）
 */
export function applyWeightsToTemplateParams(
  params: {
    clipDurationRange: { min: number; max: number; preferred: number };
    qualityWeight: number;
    sceneChangeWeight: number;
    transitionDuration: number;
    transitionType?: TransitionType;
  },
  weights: PreferenceWeights,
  strength: number = 0.5,
): typeof params {
  if (weights.sampleCount < 3) return params;

  const s = clamp(strength, 0, 1);
  const { clipDurationRange } = params;

  // 时长偏好调整
  const durationBias = weights.clipDurationBias * s;
  const durationScale = 1 + durationBias * 0.3; // 最多调整 30%

  // 场景类型权重调整质量权重
  const qualityAdjust = weights.qualityThresholdAdjust * s * 0.2;

  // 节奏偏好调整转场时长
  const paceScale = 1 - weights.pacePreference * s * 0.3;

  return {
    ...params,
    clipDurationRange: {
      min: clipDurationRange.min * durationScale,
      max: clipDurationRange.max * durationScale,
      preferred: clipDurationRange.preferred * durationScale,
    },
    qualityWeight: clamp(params.qualityWeight + qualityAdjust, 0, 1),
    transitionDuration: params.transitionDuration * paceScale,
  };
}

// ============================================================
// 风格记忆管理器
// ============================================================

/**
 * 风格记忆管理器
 * 记录用户修改行为，计算偏好权重，应用于后续生成
 */
export class StyleMemory {
  private profiles: Map<string, StyleProfile> = new Map();
  private config: StyleMemoryConfig;

  constructor(config?: Partial<StyleMemoryConfig>) {
    this.config = { ...createDefaultStyleMemoryConfig(), ...config };
  }

  /** 获取所有配置文件 */
  getAllProfiles(): StyleProfile[] {
    return Array.from(this.profiles.values());
  }

  /** 获取指定配置文件 */
  getProfile(id: string): StyleProfile | undefined {
    return this.profiles.get(id);
  }

  /** 创建配置文件 */
  createProfile(name: string, templateId?: string): StyleProfile {
    if (this.profiles.size >= this.config.maxProfiles) {
      throw new Error(`风格配置文件数量已达上限 (${this.config.maxProfiles})`);
    }
    const profile = createEmptyStyleProfile(name, templateId);
    this.profiles.set(profile.id, profile);
    return profile;
  }

  /** 删除配置文件 */
  deleteProfile(id: string): boolean {
    return this.profiles.delete(id);
  }

  /** 记录一次修改操作 */
  recordModification(
    profileId: string,
    type: ModificationType,
    before: Record<string, unknown>,
    after: Record<string, unknown>,
    context?: { sceneType?: string; mediaPath?: string; templateId?: string },
  ): ModificationRecord {
    const profile = this.profiles.get(profileId);
    if (!profile) {
      throw new Error(`风格配置文件不存在: ${profileId}`);
    }

    // 限制记录数
    if (profile.records.length >= this.config.maxRecordsPerProfile) {
      profile.records.shift();
    }

    const record: ModificationRecord = {
      id: genRecordId(),
      type,
      timestamp: Date.now(),
      templateId: context?.templateId ?? profile.templateId ?? '',
      before,
      after,
      sceneType: context?.sceneType,
      mediaPath: context?.mediaPath,
    };

    profile.records.push(record);
    profile.updatedAt = Date.now();

    // 重新计算权重
    profile.weights = calculateWeights(profile.records);

    return record;
  }

  /** 获取配置文件的偏好权重 */
  getWeights(profileId: string): PreferenceWeights {
    const profile = this.profiles.get(profileId);
    if (!profile) {
      throw new Error(`风格配置文件不存在: ${profileId}`);
    }
    return profile.weights;
  }

  /** 检查权重是否已达到最小置信度 */
  hasEnoughSamples(profileId: string): boolean {
    const profile = this.profiles.get(profileId);
    if (!profile) return false;
    return profile.weights.sampleCount >= this.config.minSampleCount;
  }

  /** 获取指定模板关联的配置文件 */
  getProfileForTemplate(templateId: string): StyleProfile | undefined {
    return Array.from(this.profiles.values()).find((p) => p.templateId === templateId);
  }

  /** 重置配置文件的记录和权重 */
  resetProfile(id: string): void {
    const profile = this.profiles.get(id);
    if (!profile) {
      throw new Error(`风格配置文件不存在: ${id}`);
    }
    profile.records = [];
    profile.weights = createDefaultPreferenceWeights();
    profile.updatedAt = Date.now();
  }

  /** 获取配置文件统计 */
  getProfileStats(profileId: string): {
    totalRecords: number;
    byType: Record<ModificationType, number>;
    hasEnoughSamples: boolean;
    topTransition: TransitionType | null;
  } {
    const profile = this.profiles.get(profileId);
    if (!profile) {
      throw new Error(`风格配置文件不存在: ${profileId}`);
    }

    const byType: Record<ModificationType, number> = {
      'clip-duration-adjust': 0,
      'clip-reorder': 0,
      'clip-remove': 0,
      'transition-change': 0,
      'transition-duration': 0,
      'volume-adjust': 0,
      'trim-adjust': 0,
      'speed-change': 0,
      'color-adjust': 0,
    };

    for (const r of profile.records) {
      byType[r.type]++;
    }

    // 最常使用的转场类型
    const transPrefs = profile.weights.transitionPreference;
    let topTransition: TransitionType | null = null;
    let maxWeight = 0;
    for (const [type, weight] of Object.entries(transPrefs)) {
      if (weight > maxWeight) {
        maxWeight = weight;
        topTransition = type as TransitionType;
      }
    }

    return {
      totalRecords: profile.records.length,
      byType,
      hasEnoughSamples: this.hasEnoughSamples(profileId),
      topTransition,
    };
  }
}

// ============================================================
// 工具函数
// ============================================================

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
