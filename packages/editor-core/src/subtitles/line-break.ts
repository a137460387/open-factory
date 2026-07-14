// ── Types ──────────────────────────────────────────────────────────────────

export interface SubtitleLineBreakConfig {
  chineseMaxCharsPerLine: number;
  englishMaxCharsPerLine: number;
  preferPunctuationBreak: boolean;
  preferPrepositionBreak: boolean;
}

export interface SubtitleLineBreakIssue {
  subtitleId: string;
  text: string;
  issueType: 'line-too-long' | 'bad-break-point' | 'single-line-too-long';
  detail: string;
  maxLineLength: number;
  threshold: number;
}

export interface SubtitleLineBreakResult {
  subtitleId: string;
  originalText: string;
  rebrokenText: string;
  changed: boolean;
}

export interface SubtitleLineBreakPreview {
  originalText: string;
  previewText: string;
  lines: string[];
}

// ── Constants ──────────────────────────────────────────────────────────────

export const DEFAULT_CHINESE_MAX_CHARS = 20;
export const DEFAULT_ENGLISH_MAX_CHARS = 42;

const CHINESE_CHAR_PATTERN = /[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/;
const CHINESE_PUNCTUATION = /[，。！？、；：…—～·「」『』【】《》〈〉（）\(\)\[\]]/;
const ENGLISH_PUNCTUATION = /[,.!?;:—\-\u2014\u2013]/;
const PREPOSITIONS_EN = new Set([
  'and',
  'but',
  'or',
  'so',
  'for',
  'yet',
  'in',
  'on',
  'at',
  'to',
  'by',
  'of',
  'with',
  'from',
  'into',
  'onto',
  'upon',
  'about',
  'above',
  'below',
  'between',
  'through',
  'during',
  'before',
  'after',
]);

const DEFAULT_CONFIG: SubtitleLineBreakConfig = {
  chineseMaxCharsPerLine: DEFAULT_CHINESE_MAX_CHARS,
  englishMaxCharsPerLine: DEFAULT_ENGLISH_MAX_CHARS,
  preferPunctuationBreak: true,
  preferPrepositionBreak: true,
};

// ── Character Classification ───────────────────────────────────────────────

export function isChineseChar(char: string): boolean {
  return CHINESE_CHAR_PATTERN.test(char);
}

export function getDisplayWidth(text: string): number {
  let width = 0;
  for (const char of text) {
    width += isChineseChar(char) ? 1 : 1;
  }
  return width;
}

export function classifyText(text: string): 'chinese' | 'english' | 'mixed' {
  let chinese = 0;
  let english = 0;
  for (const char of text) {
    if (isChineseChar(char)) {
      chinese++;
    } else if (/[a-zA-Z]/.test(char)) {
      english++;
    }
  }
  if (chinese === 0 && english === 0) {
    return 'mixed';
  }
  const ratio = chinese / (chinese + english);
  return ratio > 0.5 ? 'chinese' : ratio < 0.2 ? 'english' : 'mixed';
}

export function getMaxCharsForText(text: string, config: SubtitleLineBreakConfig = DEFAULT_CONFIG): number {
  const classification = classifyText(text);
  if (classification === 'chinese') {
    return config.chineseMaxCharsPerLine;
  }
  if (classification === 'english') {
    return config.englishMaxCharsPerLine;
  }
  return Math.max(config.chineseMaxCharsPerLine, Math.round(config.englishMaxCharsPerLine * 0.6));
}

// ── Break Point Scoring ────────────────────────────────────────────────────

interface BreakCandidate {
  position: number;
  score: number;
}

export function findBestBreakPoint(
  text: string,
  maxChars: number,
  config: SubtitleLineBreakConfig = DEFAULT_CONFIG,
): number {
  if (text.length <= maxChars) {
    return text.length;
  }

  const candidates: BreakCandidate[] = [];
  const searchEnd = Math.min(text.length, maxChars + 1);

  for (let i = 1; i < searchEnd; i++) {
    const charBefore = text[i - 1];
    const charAt = text[i];
    let score = 0;

    // Prefer breaking after punctuation
    if (config.preferPunctuationBreak) {
      if (CHINESE_PUNCTUATION.test(charBefore)) {
        score += 100;
      } else if (ENGLISH_PUNCTUATION.test(charBefore)) {
        score += 90;
      }
    }

    // Prefer breaking at spaces (word boundaries)
    if (charAt === ' ') {
      score += 80;
    } else if (charBefore === ' ') {
      score += 70;
    }

    // Prefer breaking before prepositions (English)
    if (config.preferPrepositionBreak) {
      const wordAfter = text.slice(i).match(/^([a-zA-Z]+)/);
      if (wordAfter && PREPOSITIONS_EN.has(wordAfter[1].toLowerCase())) {
        score += 60;
      }
    }

    // Prefer breaking near the middle
    const midPoint = maxChars / 2;
    const distanceFromMid = Math.abs(i - midPoint);
    score += Math.max(0, 30 - distanceFromMid);

    candidates.push({ position: i, score });
  }

  if (candidates.length === 0) {
    return maxChars;
  }

  candidates.sort((a, b) => b.score - a.score || a.position - b.position);
  return candidates[0].position;
}

// ── Line Breaking ──────────────────────────────────────────────────────────

export function smartLineBreak(text: string, config: SubtitleLineBreakConfig = DEFAULT_CONFIG): string {
  const cleanText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const existingLines = cleanText.split('\n');

  const resultLines: string[] = [];
  for (const line of existingLines) {
    resultLines.push(...breakSingleLine(line, config));
  }
  return resultLines.join('\n');
}

function breakSingleLine(line: string, config: SubtitleLineBreakConfig): string[] {
  const trimmed = line.trim();
  if (!trimmed) {
    return [''];
  }

  const maxChars = getMaxCharsForText(trimmed, config);
  if (trimmed.length <= maxChars) {
    return [trimmed];
  }

  const lines: string[] = [];
  let remaining = trimmed;

  while (remaining.length > maxChars) {
    const breakAt = findBestBreakPoint(remaining, maxChars, config);
    lines.push(remaining.slice(0, breakAt).trimEnd());
    remaining = remaining.slice(breakAt).trimStart();
  }

  if (remaining) {
    lines.push(remaining);
  }

  return lines;
}

// ── Issue Detection ────────────────────────────────────────────────────────

export function detectLineBreakIssues(
  subtitles: Array<{ id: string; text: string }>,
  config: SubtitleLineBreakConfig = DEFAULT_CONFIG,
): SubtitleLineBreakIssue[] {
  const issues: SubtitleLineBreakIssue[] = [];

  for (const subtitle of subtitles) {
    const lines = subtitle.text.split('\n');
    const maxChars = getMaxCharsForText(subtitle.text, config);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.length > maxChars) {
        issues.push({
          subtitleId: subtitle.id,
          text: subtitle.text,
          issueType: 'line-too-long',
          detail: `行 ${i + 1} 长度 ${line.length} 超过阈值 ${maxChars}`,
          maxLineLength: line.length,
          threshold: maxChars,
        });
        break; // One issue per subtitle
      }
    }

    // Check for bad break points (breaking in the middle of a word)
    if (lines.length > 1) {
      for (let i = 0; i < lines.length - 1; i++) {
        const lineEnd = lines[i].trimEnd();
        const nextLineStart = lines[i + 1].trimStart();
        if (lineEnd.length > 0 && nextLineStart.length > 0) {
          const lastChar = lineEnd[lineEnd.length - 1];
          const firstChar = nextLineStart[0];
          // Check if break happens in middle of English word
          if (
            /[a-zA-Z]/.test(lastChar) &&
            /[a-zA-Z]/.test(firstChar) &&
            !/\s/.test(lineEnd) &&
            !ENGLISH_PUNCTUATION.test(lastChar)
          ) {
            issues.push({
              subtitleId: subtitle.id,
              text: subtitle.text,
              issueType: 'bad-break-point',
              detail: `在第 ${i + 1} 和 ${i + 2} 行之间断行位置不合理（断在单词中间）`,
              maxLineLength: Math.max(...lines.map((l) => l.length)),
              threshold: maxChars,
            });
            break;
          }
        }
      }
    }
  }

  return issues;
}

// ── Batch Re-break ─────────────────────────────────────────────────────────

export function batchRebreakSubtitles(
  subtitles: Array<{ id: string; text: string }>,
  config: SubtitleLineBreakConfig = DEFAULT_CONFIG,
): SubtitleLineBreakResult[] {
  return subtitles.map((subtitle) => {
    const rebroken = smartLineBreak(subtitle.text, config);
    return {
      subtitleId: subtitle.id,
      originalText: subtitle.text,
      rebrokenText: rebroken,
      changed: rebroken !== subtitle.text,
    };
  });
}

// ── Preview ────────────────────────────────────────────────────────────────

export function previewLineBreak(
  text: string,
  config: SubtitleLineBreakConfig = DEFAULT_CONFIG,
): SubtitleLineBreakPreview {
  const preview = smartLineBreak(text, config);
  return {
    originalText: text,
    previewText: preview,
    lines: preview.split('\n'),
  };
}

// ── Whisper Integration ────────────────────────────────────────────────────

export function applyLineBreakToWhisperOutput(text: string, config: SubtitleLineBreakConfig = DEFAULT_CONFIG): string {
  return smartLineBreak(text, config);
}

export function normalizeLineBreakConfig(
  config: Partial<SubtitleLineBreakConfig> | undefined,
): SubtitleLineBreakConfig {
  return {
    chineseMaxCharsPerLine: clampPositive(config?.chineseMaxCharsPerLine, DEFAULT_CHINESE_MAX_CHARS),
    englishMaxCharsPerLine: clampPositive(config?.englishMaxCharsPerLine, DEFAULT_ENGLISH_MAX_CHARS),
    preferPunctuationBreak: config?.preferPunctuationBreak ?? true,
    preferPrepositionBreak: config?.preferPrepositionBreak ?? true,
  };
}

function clampPositive(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.round(value) : fallback;
}
