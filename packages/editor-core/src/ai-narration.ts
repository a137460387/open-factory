export type NarrationStyle = 'commentary' | 'advertisement' | 'documentary' | 'social-media';

export const NARRATION_STYLES: NarrationStyle[] = ['commentary', 'advertisement', 'documentary', 'social-media'];

export const NARRATION_CHARS_PER_SECOND_ZH = 4;
export const NARRATION_WORDS_PER_SECOND_EN = 2.5;

export interface NarrationSegment {
  markerTime: number;
  duration: number;
  text: string;
  speakerNote: string;
}

export interface NarrationChapterInput {
  time: number;
  duration: number;
  label: string;
  sceneDescription: string;
  subtitleText: string;
}

const STYLE_PROMPTS: Record<NarrationStyle, string> = {
  commentary: '你是一位专业的解说旁白撰稿人。请为每个章节撰写简洁、清晰的旁白文稿，语气正式且专业，注重信息传达的准确性。',
  advertisement: '你是一位广告文案撰稿人。请为每个章节撰写富有感染力和号召力的旁白文稿，语气积极热情，注重打动观众。',
  documentary: '你是一位纪录片叙事撰稿人。请为每个章节撰写富有叙事感和深度的旁白文稿，语气沉稳、有深度，注重故事性和情感表达。',
  'social-media': '你是一位活泼的社媒内容创作者。请为每个章节撰写轻松有趣、口语化的旁白文稿，语气活泼亲切，注重与观众的互动感。',
};

export function estimateWordCount(durationSeconds: number, isChinese: boolean): { min: number; max: number } {
  const safeDuration = Number.isFinite(durationSeconds) ? Math.max(0, durationSeconds) : 0;
  if (isChinese) {
    const base = Math.round(safeDuration * NARRATION_CHARS_PER_SECOND_ZH);
    return { min: Math.max(1, Math.round(base * 0.8)), max: Math.max(1, Math.round(base * 1.2)) };
  }
  const base = Math.round(safeDuration * NARRATION_WORDS_PER_SECOND_EN);
  return { min: Math.max(1, Math.round(base * 0.8)), max: Math.max(1, Math.round(base * 1.2)) };
}

export function buildNarrationSystemPrompt(style: NarrationStyle, isChinese: boolean): string {
  const stylePrompt = STYLE_PROMPTS[style] ?? STYLE_PROMPTS.commentary;
  const langInstruction = isChinese ? '请用中文撰写旁白文稿。' : 'Please write the narration in English.';
  return [
    stylePrompt,
    langInstruction,
    '用户会提供视频项目的章节信息，每个章节包含时间码、时长、场景描述和字幕片段。',
    '请为每个章节生成旁白文稿。',
    '',
    '返回一个JSON数组，每个元素格式如下：',
    '{',
    '  "markerTime": 秒数（对应章节起始时间）,',
    '  "duration": 秒数（对应章节时长）,',
    '  "text": "旁白文稿文本",',
    '  "speakerNote": "朗读提示（语气/停顿等，给配音员或TTS的提示）"',
    '}',
    '',
    '要求：',
    '- text 的字数要适合对应章节的时长',
    '- speakerNote 简短描述朗读时的语气、节奏和停顿',
    '- 只返回JSON数组，不要其他内容',
  ].join('\n');
}

export function buildNarrationUserPrompt(chapters: NarrationChapterInput[]): string {
  const lines: string[] = [];
  lines.push('共有 ' + String(chapters.length) + ' 个章节：');
  lines.push('');
  for (let i = 0; i < chapters.length; i++) {
    const ch = chapters[i];
    lines.push('章节 ' + String(i + 1) + '：');
    lines.push('  起始时间: ' + formatNarrationTimecode(ch.time));
    lines.push('  时长: ' + formatNarrationTimecode(ch.duration));
    if (ch.label) lines.push('  标签: ' + ch.label);
    if (ch.sceneDescription) lines.push('  场景描述: ' + ch.sceneDescription);
    if (ch.subtitleText) lines.push('  字幕片段: ' + ch.subtitleText);
    lines.push('');
  }
  return lines.join('\n');
}

export function buildChaptersFromMarkers(
  markers: Array<{ time: number; label?: string }>,
  totalDuration: number,
  sceneDescriptions: Map<number, string>,
  subtitleTextMap: Map<number, string>,
): NarrationChapterInput[] {
  const sorted = [...markers].sort((a, b) => a.time - b.time);
  const safeDuration = Number.isFinite(totalDuration) ? Math.max(0, totalDuration) : 0;
  const chapters: NarrationChapterInput[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const start = sorted[i].time;
    const end = i + 1 < sorted.length ? sorted[i + 1].time : safeDuration;
    const duration = Math.max(0, end - start);
    chapters.push({
      time: start,
      duration,
      label: sorted[i].label ?? '',
      sceneDescription: sceneDescriptions.get(start) ?? '',
      subtitleText: subtitleTextMap.get(start) ?? '',
    });
  }
  return chapters;
}

export function parseNarrationResponse(json: unknown): NarrationSegment[] {
  if (!Array.isArray(json)) return [];
  const segments: NarrationSegment[] = [];
  for (const item of json) {
    if (!item || typeof item !== 'object') continue;
    const record = item as Record<string, unknown>;
    if (typeof record.markerTime !== 'number' || typeof record.duration !== 'number') continue;
    const text = typeof record.text === 'string' ? record.text.trim() : '';
    const speakerNote = typeof record.speakerNote === 'string' ? record.speakerNote.trim() : '';
    if (text.length === 0) continue;
    segments.push({
      markerTime: Math.max(0, record.markerTime),
      duration: Math.max(0, record.duration),
      text,
      speakerNote,
    });
  }
  return segments;
}

export function buildTtsRequests(
  segments: NarrationSegment[],
  voiceId: string,
): Array<{ text: string; markerTime: number; voiceId: string }> {
  return segments
    .filter((s) => s.text.trim().length > 0)
    .map((s) => ({ text: s.text, markerTime: s.markerTime, voiceId }));
}

function formatNarrationTimecode(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const totalSeconds = Math.floor(seconds);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return String(m) + ':' + String(s).padStart(2, '0');
}
