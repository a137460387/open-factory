export const SUMMARY_FRAME_COUNT = 8;
export const SUMMARY_MAX_SUBTITLE_CHARS = 1000;

import type { Clip, TimelineMarker, SubtitleClip, Project, Track } from './model-types';
import { round } from './time';

export interface VideoSummaryScene {
  time: number;
  description: string;
}

export interface VideoSummaryKeyMoment {
  time: number;
  description: string;
}

export interface VideoSummaryResult {
  title: string;
  summary: string;
  scenes: VideoSummaryScene[];
  emotionArc: string;
  keyMoments: VideoSummaryKeyMoment[];
  tags: string[];
}

export interface VideoSummaryDataPack {
  duration: number;
  trackCount: number;
  clipCount: number;
  markers: Array<{ time: number; label: string }>;
  subtitleText: string;
  aiSummaries: string[];
}

export function buildSummaryFrameTimestamps(duration: number, count = SUMMARY_FRAME_COUNT): number[] {
  const safeDuration = Number.isFinite(duration) ? Math.max(0, duration) : 0;
  const safeCount = Math.min(24, Math.max(1, Math.round(Number.isFinite(count) ? count : SUMMARY_FRAME_COUNT)));
  if (safeDuration <= 0) {
    return Array.from({ length: safeCount }, () => 0);
  }
  const step = safeDuration / (safeCount + 1);
  return Array.from({ length: safeCount }, (_item, index) => round(Math.min(safeDuration, step * (index + 1))));
}

export function buildSummaryDataPack(project: Project): VideoSummaryDataPack {
  const tracks = project.timeline.tracks;
  const allClips = tracks.flatMap((t: Track) => t.clips);
  const maxDuration = allClips.reduce((max: number, c: Clip) => {
    const end = c.start + c.duration;
    return end > max ? end : max;
  }, 0);
  const markers = (project.timeline.markers ?? []).map((m: TimelineMarker) => ({ time: m.time, label: m.label ?? '' }));
  const subtitleClips = allClips.filter((c: Clip): c is SubtitleClip => c.type === 'subtitle');
  const subtitleText = subtitleClips
    .map((s: SubtitleClip) => s.text)
    .join(' ')
    .slice(0, SUMMARY_MAX_SUBTITLE_CHARS);
  const aiSummaries = project.media
    .map((m) => m.aiAnalysis?.scene)
    .filter((s): s is string => typeof s === 'string' && s.trim().length > 0);
  return {
    duration: round(maxDuration),
    trackCount: tracks.length,
    clipCount: allClips.length,
    markers,
    subtitleText,
    aiSummaries,
  };
}

export function buildSummarySystemPrompt(): string {
  return [
    '你是一个专业的视频内容分析助手。用户会提供一个视频项目的结构化数据和若干截帧图片。',
    '请综合分析这些信息，返回一个JSON对象，格式如下：',
    '{',
    '  "title": "视频标题（简短有吸引力）",',
    '  "summary": "2~3段内容摘要文字",',
    '  "scenes": [{"time": 秒数, "description": "场景描述"}],',
    '  "emotionArc": "情绪弧线描述（文字形式，描述情绪变化趋势）",',
    '  "keyMoments": [{"time": 秒数, "description": "关键时刻描述"}],',
    '  "tags": ["标签1", "标签2", "标签3"]',
    '}',
    '',
    '要求：',
    '- scenes 不超过8个，覆盖视频主要段落',
    '- keyMoments 不超过5个，选取最重要的转折点',
    '- tags 不超过10个，概括视频主题和内容',
    '- summary 用中文撰写，2~3段',
    '- 只返回JSON，不要其他内容',
  ].join('\n');
}

export function buildSummaryUserPrompt(data: VideoSummaryDataPack): string {
  const lines: string[] = [];
  lines.push('项目时长: ' + formatTimecode(data.duration));
  lines.push('轨道数: ' + String(data.trackCount));
  lines.push('片段数: ' + String(data.clipCount));
  if (data.markers.length > 0) {
    lines.push('章节标记:');
    for (const m of data.markers) {
      lines.push('  ' + formatTimecode(m.time) + ' ' + m.label);
    }
  }
  if (data.subtitleText.length > 0) {
    lines.push('字幕文本片段: ' + data.subtitleText);
  }
  if (data.aiSummaries.length > 0) {
    lines.push('素材AI分析摘要:');
    for (const s of data.aiSummaries) {
      lines.push('  ' + s);
    }
  }
  return lines.join('\n');
}

export function parseVideoSummaryResponse(json: unknown): VideoSummaryResult {
  const empty: VideoSummaryResult = { title: '', summary: '', scenes: [], emotionArc: '', keyMoments: [], tags: [] };
  if (!json || typeof json !== 'object') return empty;
  const input = json as Record<string, unknown>;
  const title = typeof input.title === 'string' ? input.title.trim() : '';
  const summary = typeof input.summary === 'string' ? input.summary.trim() : '';
  const emotionArc = typeof input.emotionArc === 'string' ? input.emotionArc.trim() : '';
  const scenes = Array.isArray(input.scenes)
    ? (input.scenes as unknown[])
        .filter(
          (s): s is Record<string, unknown> =>
            s != null &&
            typeof s === 'object' &&
            typeof (s as Record<string, unknown>).time === 'number' &&
            typeof (s as Record<string, unknown>).description === 'string',
        )
        .map((s) => ({
          time: Math.max(0, round((s as Record<string, unknown>).time as number)),
          description: ((s as Record<string, unknown>).description as string).trim(),
        }))
        .filter((s) => s.description.length > 0)
    : [];
  const keyMoments = Array.isArray(input.keyMoments)
    ? (input.keyMoments as unknown[])
        .filter(
          (k): k is Record<string, unknown> =>
            k != null &&
            typeof k === 'object' &&
            typeof (k as Record<string, unknown>).time === 'number' &&
            typeof (k as Record<string, unknown>).description === 'string',
        )
        .map((k) => ({
          time: Math.max(0, round((k as Record<string, unknown>).time as number)),
          description: ((k as Record<string, unknown>).description as string).trim(),
        }))
        .filter((k) => k.description.length > 0)
    : [];
  const tags = Array.isArray(input.tags)
    ? (input.tags as unknown[])
        .filter((t): t is string => typeof t === 'string')
        .map((t) => t.trim())
        .filter(Boolean)
    : [];
  return { title, summary, scenes, emotionArc, keyMoments, tags };
}

export function generateSummaryFilename(projectName: string): string {
  const safe = (projectName || '未命名项目').replace(/[<>:"/\\|?*]/g, '_').trim() || '未命名项目';
  const now = new Date();
  const date =
    String(now.getFullYear()) + String(now.getMonth() + 1).padStart(2, '0') + String(now.getDate()).padStart(2, '0');
  return safe + '_摘要_' + date + '.html';
}

export function formatTimecode(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '00:00';
  const totalSeconds = Math.floor(seconds);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) {
    return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
  }
  return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function generateTagCloudSvg(tags: string[]): string {
  if (tags.length === 0) return '';
  const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];
  const items = tags
    .map((tag, i) => {
      const x = 20 + (i % 4) * 180;
      const y = 30 + Math.floor(i / 4) * 40;
      const size = 12 + Math.abs((i * 7 + 3) % 5);
      const color = colors[i % colors.length];
      return (
        '<text x="' +
        x +
        '" y="' +
        y +
        '" font-size="' +
        size +
        '" fill="' +
        color +
        '" font-family="sans-serif">' +
        escapeHtml(tag) +
        '</text>'
      );
    })
    .join('\n');
  const rows = Math.ceil(tags.length / 4);
  const height = rows * 40 + 20;
  return '<svg width="720" height="' + height + '" xmlns="http://www.w3.org/2000/svg">\n' + items + '\n</svg>';
}

export function generateSummaryHtml(result: VideoSummaryResult, projectName: string, frameBase64s: string[]): string {
  const generatedTime = new Date().toLocaleString('zh-CN');
  const tagCloudSvg = result.tags.length > 0 ? generateTagCloudSvg(result.tags) : '';
  const scenesHtml = result.scenes
    .map((scene, i) => {
      const imgSrc = frameBase64s[i] ? 'data:image/jpeg;base64,' + frameBase64s[i] : '';
      return (
        '<div class="scene-item"><div class="scene-time">' +
        formatTimecode(scene.time) +
        '</div>' +
        (imgSrc ? '<img src="' + imgSrc + '" alt="场景 ' + (i + 1) + '" />' : '') +
        '<div class="scene-desc">' +
        escapeHtml(scene.description) +
        '</div></div>'
      );
    })
    .join('\n');
  const keyMomentsHtml = result.keyMoments
    .map((km) => {
      return '<li><span class="km-time">' + formatTimecode(km.time) + '</span> ' + escapeHtml(km.description) + '</li>';
    })
    .join('\n');
  return (
    '<!DOCTYPE html>\n<html lang="zh-CN">\n<head>\n<meta charset="UTF-8" />\n<meta name="viewport" content="width=device-width, initial-scale=1.0" />\n<title>' +
    escapeHtml(result.title || projectName) +
    ' - AI视频摘要</title>\n<style>\nbody { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; max-width: 800px; margin: 0 auto; padding: 40px 20px; color: #1e293b; background: #f8fafc; }\nh1 { font-size: 24px; margin-bottom: 4px; }\n.meta { color: #64748b; font-size: 13px; margin-bottom: 24px; }\nh2 { font-size: 18px; margin-top: 32px; margin-bottom: 12px; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px; }\n.summary-text { line-height: 1.8; font-size: 14px; margin-bottom: 16px; }\n.scene-item { display: flex; gap: 12px; align-items: flex-start; margin-bottom: 16px; padding: 12px; background: #fff; border-radius: 8px; border: 1px solid #e2e8f0; }\n.scene-item img { width: 160px; height: 90px; object-fit: cover; border-radius: 4px; flex-shrink: 0; }\n.scene-time { font-family: monospace; font-size: 12px; color: #3b82f6; background: #eff6ff; padding: 2px 8px; border-radius: 4px; white-space: nowrap; }\n.scene-desc { font-size: 14px; line-height: 1.6; }\n.emotion-arc { font-size: 14px; line-height: 1.8; padding: 16px; background: #fff; border-radius: 8px; border: 1px solid #e2e8f0; }\n.key-moments li { margin-bottom: 8px; font-size: 14px; line-height: 1.6; }\n.km-time { font-family: monospace; font-size: 12px; color: #f59e0b; background: #fffbeb; padding: 2px 8px; border-radius: 4px; margin-right: 8px; }\n.tag-cloud { text-align: center; padding: 24px; }\n.tags-inline { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; }\n.tags-inline span { display: inline-block; background: #eff6ff; color: #1d4ed8; padding: 4px 12px; border-radius: 16px; font-size: 13px; }\n</style>\n</head>\n<body>\n<h1>' +
    escapeHtml(result.title || projectName) +
    '</h1>\n<div class="meta">项目: ' +
    escapeHtml(projectName) +
    ' | 生成时间: ' +
    generatedTime +
    '</div>\n<h2>内容摘要</h2>\n' +
    result.summary
      .split('\n')
      .filter(Boolean)
      .map((p) => '<div class="summary-text">' + escapeHtml(p) + '</div>')
      .join('\n') +
    '\n<h2>场景时间线</h2>\n' +
    (scenesHtml || '<p style="color:#94a3b8">暂无场景数据</p>') +
    '\n<h2>情绪弧线</h2>\n<div class="emotion-arc">' +
    (escapeHtml(result.emotionArc) || '<span style="color:#94a3b8">暂无数据</span>') +
    '</div>\n<h2>关键时刻</h2>\n<ul class="key-moments">' +
    (keyMomentsHtml || '<li style="color:#94a3b8">暂无关键时刻数据</li>') +
    '</ul>\n<h2>标签</h2>\n<div class="tag-cloud">' +
    (tagCloudSvg ||
      '<div class="tags-inline">' +
        result.tags.map((tag) => '<span>' + escapeHtml(tag) + '</span>').join('') +
        '</div>') +
    '</div>\n</body>\n</html>'
  );
}
