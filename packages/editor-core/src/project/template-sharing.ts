import type { ProjectSettings } from '../model-types';
import type { TrackType } from '../model-types';

/**
 * 项目模板社区共享系统。
 * 复用导出预设市场的基础设施。
 */

export type TemplateCategory = '婚礼' | '产品展示' | '教程' | 'Vlog' | '短视频' | '纪录片' | '其他';

export interface CommunityTemplateCard {
  id: string;
  name: string;
  author: string;
  description: string;
  tags: TemplateCategory[];
  thumbnailUrl: string;
  downloadCount: number;
  templateData: SerializedTemplate;
  publishedAt: string;
  updatedAt: string;
}

export interface SerializedTemplate {
  schemaVersion: 1;
  name: string;
  description: string;
  settings: ProjectSettings;
  tracks: SerializedTemplateTrack[];
  createdAt: string;
}

export interface SerializedTemplateTrack {
  type: TrackType;
  name: string;
  clipCount: number;
  /** 占位 clip 的描述（不含真实媒体路径） */
  clipPlaceholders: Array<{
    name: string;
    start: number;
    duration: number;
  }>;
}

export interface TemplateMarketCache {
  version: 1;
  lastFetched: string;
  templates: CommunityTemplateCard[];
}

export interface InstallTemplateResult {
  templateId: string;
  templateName: string;
  installed: boolean;
}

/**
 * 序列化当前项目结构为模板文件（脱敏，不含真实媒体路径）。
 */
export function serializeProjectAsTemplate(
  project: { name: string; settings: ProjectSettings; timeline: { tracks: Array<{ type: TrackType; name: string; clips: Array<{ name: string; start: number; duration: number }> }> } },
  description: string
): SerializedTemplate {
  return {
    schemaVersion: 1,
    name: project.name,
    description,
    settings: { ...project.settings },
    tracks: project.timeline.tracks.map((track) => ({
      type: track.type,
      name: track.name,
      clipCount: track.clips.length,
      clipPlaceholders: track.clips.map((clip) => ({
        name: clip.name,
        start: clip.start,
        duration: clip.duration,
      })),
    })),
    createdAt: new Date().toISOString(),
  };
}

/**
 * 解析模板卡片 JSON。
 */
export function parseTemplateCards(json: string): CommunityTemplateCard[] {
  try {
    const parsed = JSON.parse(json);
    if (Array.isArray(parsed)) {
      return parsed.filter(
        (card: unknown) =>
          card &&
          typeof (card as CommunityTemplateCard).id === 'string' &&
          typeof (card as CommunityTemplateCard).name === 'string'
      );
    }
    return [];
  } catch {
    return [];
  }
}

/**
 * 解析市场缓存。
 */
export function parseTemplateMarketCache(json: string): TemplateMarketCache {
  try {
    const parsed = JSON.parse(json);
    if (parsed && parsed.version === 1 && Array.isArray(parsed.templates)) {
      return {
        version: 1,
        lastFetched: parsed.lastFetched ?? new Date().toISOString(),
        templates: parseTemplateCards(JSON.stringify(parsed.templates)),
      };
    }
    return { version: 1, lastFetched: new Date().toISOString(), templates: [] };
  } catch {
    return { version: 1, lastFetched: new Date().toISOString(), templates: [] };
  }
}

/**
 * 序列化市场缓存。
 */
export function serializeTemplateMarketCache(cache: TemplateMarketCache): string {
  return JSON.stringify(cache, null, 2) + '\n';
}

/**
 * 安装模板到本地列表。
 * 返回更新后的已安装模板 ID 列表。
 */
export function installTemplate(
  installedIds: string[],
  templateId: string
): { installedIds: string[]; result: InstallTemplateResult } {
  if (installedIds.includes(templateId)) {
    return {
      installedIds,
      result: { templateId, templateName: '', installed: false },
    };
  }
  return {
    installedIds: [...installedIds, templateId],
    result: { templateId, templateName: '', installed: true },
  };
}

/**
 * 检查模板是否已安装。
 */
export function isTemplateInstalled(installedIds: string[], templateId: string): boolean {
  return installedIds.includes(templateId);
}

/**
 * 网络不可用降级：返回本地缓存的模板列表。
 */
export function getOfflineTemplates(cache: TemplateMarketCache): CommunityTemplateCard[] {
  return cache.templates;
}
