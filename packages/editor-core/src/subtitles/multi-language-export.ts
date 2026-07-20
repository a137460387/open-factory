import type { SubtitleClip, SubtitleStyle, Timeline, Track } from '../model';
import {
  serializeSubtitleCueInputsToSrt,
  serializeSubtitleCueInputsToVtt,
  serializeSubtitleCueInputsToAss,
  type SubtitleCueInput,
  type SubtitleTextFormat,
} from './srt';
import { normalizeSubtitleLanguage } from '../model';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** 多语言字幕导出选项 */
export interface MultiLanguageSubtitleExportOptions {
  /** 导出格式 */
  format: SubtitleTextFormat;
  /** 要导出的语言（为空则导出全部） */
  languages?: string[];
  /** 是否合并为单个文件 */
  mergeIntoSingleFile?: boolean;
  /** 合并时的语言分隔符 */
  mergeSeparator?: string;
  /** 是否包含语言标识 */
  includeLanguageMetadata?: boolean;
  /** 自定义文件名模板 */
  filenameTemplate?: string;
}

/** 语言字幕组 */
export interface LanguageSubtitleGroup {
  /** 语言代码 */
  language: string;
  /** 语言显示名称 */
  displayName: string;
  /** 该语言的字幕片段 */
  clips: SubtitleClip[];
  /** 所属轨道 */
  trackId: string;
}

/** 导出结果 */
export interface MultiLanguageSubtitleExportResult {
  /** 导出的文件列表 */
  files: SubtitleExportFile[];
  /** 总字幕数 */
  totalCues: number;
  /** 导出的语言数 */
  languageCount: number;
}

/** 导出文件 */
export interface SubtitleExportFile {
  /** 文件名 */
  filename: string;
  /** 文件内容 */
  content: string;
  /** 语言代码 */
  language: string;
  /** 格式 */
  format: SubtitleTextFormat;
  /** 字幕数量 */
  cueCount: number;
}

// ---------------------------------------------------------------------------
// Multi-Language Export
// ---------------------------------------------------------------------------

/**
 * 导出多语言字幕
 */
export function exportMultiLanguageSubtitles(
  timeline: Timeline,
  options: MultiLanguageSubtitleExportOptions,
): MultiLanguageSubtitleExportResult {
  const { format, languages, mergeIntoSingleFile = false } = options;

  // 按语言分组字幕
  const languageGroups = groupSubtitlesByLanguage(timeline);

  // 过滤语言
  const filteredGroups =
    languages && languages.length > 0
      ? languageGroups.filter((group) => languages.includes(group.language))
      : languageGroups;

  if (filteredGroups.length === 0) {
    return { files: [], totalCues: 0, languageCount: 0 };
  }

  // 合并模式
  if (mergeIntoSingleFile && filteredGroups.length > 1) {
    return exportMergedSubtitles(filteredGroups, options);
  }

  // 分别导出每种语言
  const files: SubtitleExportFile[] = [];
  let totalCues = 0;

  for (const group of filteredGroups) {
    const cues = convertClipsToCueInputs(group.clips);
    const content = serializeCues(cues, format);
    const filename = generateFilename(group.language, format, options.filenameTemplate);

    files.push({
      filename,
      content,
      language: group.language,
      format,
      cueCount: cues.length,
    });

    totalCues += cues.length;
  }

  return {
    files,
    totalCues,
    languageCount: filteredGroups.length,
  };
}

/**
 * 按语言分组字幕
 */
export function groupSubtitlesByLanguage(timeline: Timeline): LanguageSubtitleGroup[] {
  const groups: LanguageSubtitleGroup[] = [];

  for (const track of timeline.tracks) {
    if (track.type !== 'subtitle') {
      continue;
    }

    const language = normalizeSubtitleLanguage(track.language) || 'und';
    const displayName = getLanguageDisplayName(language);
    const clips = track.clips.filter((clip): clip is SubtitleClip => clip.type === 'subtitle');

    if (clips.length > 0) {
      groups.push({
        language,
        displayName,
        clips,
        trackId: track.id,
      });
    }
  }

  return groups;
}

/**
 * 获取可用的语言列表
 */
export function getAvailableLanguages(timeline: Timeline): Array<{ code: string; name: string; count: number }> {
  const groups = groupSubtitlesByLanguage(timeline);
  return groups.map((group) => ({
    code: group.language,
    name: group.displayName,
    count: group.clips.length,
  }));
}

/**
 * 导出为独立文件（每种语言一个文件）
 */
export function exportSubtitlesAsSeparateFiles(
  timeline: Timeline,
  format: SubtitleTextFormat,
  languages?: string[],
): SubtitleExportFile[] {
  const result = exportMultiLanguageSubtitles(timeline, {
    format,
    languages,
    mergeIntoSingleFile: false,
  });

  return result.files;
}

/**
 * 导出为合并文件
 */
export function exportSubtitlesAsMergedFile(
  timeline: Timeline,
  format: SubtitleTextFormat,
  options?: {
    languages?: string[];
    separator?: string;
    includeLanguageHeaders?: boolean;
  },
): SubtitleExportFile | null {
  const { languages, separator = '\n\n---\n\n', includeLanguageHeaders = true } = options || {};

  const groups = groupSubtitlesByLanguage(timeline);
  const filteredGroups =
    languages && languages.length > 0 ? groups.filter((group) => languages.includes(group.language)) : groups;

  if (filteredGroups.length === 0) {
    return null;
  }

  // 为每种语言生成内容
  const parts: string[] = [];
  let totalCues = 0;

  for (const group of filteredGroups) {
    const cues = convertClipsToCueInputs(group.clips);
    let content = serializeCues(cues, format);

    // 添加语言头部
    if (includeLanguageHeaders) {
      content = `## ${group.displayName} (${group.language})\n\n${content}`;
    }

    parts.push(content);
    totalCues += cues.length;
  }

  // 合并内容
  const mergedContent = parts.join(separator);

  // 生成文件名
  const filename = `subtitles_merged.${format}`;

  return {
    filename,
    content: mergedContent,
    language: 'multi',
    format,
    cueCount: totalCues,
  };
}

/**
 * 嵌入字幕到视频（生成 FFmpeg 参数）
 */
export function buildSubtitleEmbedArgs(
  timeline: Timeline,
  options: {
    format: SubtitleTextFormat;
    languages?: string[];
    burnIn?: boolean;
    defaultLanguage?: string;
  },
): SubtitleEmbedResult {
  const { format, languages, burnIn = false, defaultLanguage } = options;
  const groups = groupSubtitlesByLanguage(timeline);
  const filteredGroups =
    languages && languages.length > 0 ? groups.filter((group) => languages.includes(group.language)) : groups;

  if (filteredGroups.length === 0) {
    return { args: [], files: [], burnInFilter: null };
  }

  const files: Array<{ filename: string; content: string; language: string }> = [];
  const inputArgs: string[] = [];
  const mapArgs: string[] = [];

  for (let i = 0; i < filteredGroups.length; i++) {
    const group = filteredGroups[i];
    const cues = convertClipsToCueInputs(group.clips);
    const content = serializeCues(cues, format);
    const filename = `subtitle_${group.language}.${format}`;

    files.push({
      filename,
      content,
      language: group.language,
    });

    // 添加输入参数
    inputArgs.push('-i', filename);

    // 添加映射参数
    const isDefault = group.language === defaultLanguage || (i === 0 && !defaultLanguage);
    mapArgs.push(
      '-map',
      `${i + 1}:s`,
      `-metadata:s:s:${i}`,
      `language=${group.language}`,
      isDefault ? `-disposition:s:${i}` : `-disposition:s:${i} 0`,
      ...(isDefault ? ['default'] : []),
    );
  }

  // 烧录字幕（硬字幕）
  let burnInFilter: string | null = null;
  if (burnIn && filteredGroups.length > 0) {
    const defaultGroup = filteredGroups.find((g) => g.language === defaultLanguage) || filteredGroups[0];
    burnInFilter = `subtitles=subtitle_${defaultGroup.language}.${format}`;
  }

  return {
    args: [...inputArgs, ...mapArgs],
    files,
    burnInFilter,
  };
}

/** 字幕嵌入结果 */
export interface SubtitleEmbedResult {
  /** FFmpeg 参数 */
  args: string[];
  /** 字幕文件列表 */
  files: Array<{ filename: string; content: string; language: string }>;
  /** 烧录滤镜（硬字幕） */
  burnInFilter: string | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function convertClipsToCueInputs(clips: SubtitleClip[]): SubtitleCueInput[] {
  return clips
    .filter((clip) => clip.duration > 0 && clip.text.trim().length > 0)
    .sort((a, b) => a.start - b.start)
    .map((clip) => ({
      id: clip.id,
      start: clip.start,
      duration: clip.duration,
      text: clip.text,
      subtitleType: clip.subtitleType,
      speaker: clip.speaker,
      soundDesc: clip.soundDesc,
      style: clip.style
        ? {
            fontFamily: clip.style.fontFamily,
            fontSize: clip.style.fontSize,
            color: clip.style.color,
            backgroundColor: clip.style.backgroundColor,
            backgroundOpacity: clip.style.backgroundOpacity,
            outlineColor: clip.style.outlineColor,
            outlineWidth: clip.style.outlineWidth,
            shadowColor: clip.style.shadowColor,
            shadowOffset: clip.style.shadowOffset,
            bold: clip.style.bold,
            italic: clip.style.italic,
            yOffset: clip.style.yOffset,
          }
        : undefined,
    }));
}

function serializeCues(cues: SubtitleCueInput[], format: SubtitleTextFormat): string {
  switch (format) {
    case 'vtt':
      return serializeSubtitleCueInputsToVtt(cues);
    case 'ass':
    case 'ssa':
      return serializeSubtitleCueInputsToAss(cues, format);
    case 'srt':
    default:
      return serializeSubtitleCueInputsToSrt(cues);
  }
}

function generateFilename(language: string, format: SubtitleTextFormat, template?: string): string {
  if (template) {
    return template.replace('{language}', language).replace('{format}', format);
  }

  return `subtitles_${language}.${format}`;
}

function exportMergedSubtitles(
  groups: LanguageSubtitleGroup[],
  options: MultiLanguageSubtitleExportOptions,
): MultiLanguageSubtitleExportResult {
  const { format, mergeSeparator = '\n\n---\n\n', includeLanguageMetadata = true } = options;
  const parts: string[] = [];
  let totalCues = 0;

  for (const group of groups) {
    const cues = convertClipsToCueInputs(group.clips);
    let content = serializeCues(cues, format);

    if (includeLanguageMetadata) {
      content = `## ${group.displayName} (${group.language})\n\n${content}`;
    }

    parts.push(content);
    totalCues += cues.length;
  }

  const mergedContent = parts.join(mergeSeparator);
  const filename = `subtitles_merged.${format}`;

  return {
    files: [
      {
        filename,
        content: mergedContent,
        language: 'multi',
        format,
        cueCount: totalCues,
      },
    ],
    totalCues,
    languageCount: groups.length,
  };
}

function getLanguageDisplayName(language: string): string {
  const languageNames: Record<string, string> = {
    zh: '中文',
    en: 'English',
    ja: '日本語',
    ko: '한국어',
    fr: 'Français',
    de: 'Deutsch',
    es: 'Español',
    pt: 'Português',
    ru: 'Русский',
    ar: 'العربية',
    it: 'Italiano',
    und: '未指定',
  };

  return languageNames[language] || language.toUpperCase();
}
