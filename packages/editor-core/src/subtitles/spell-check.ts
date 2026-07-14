import { secondsToTimecode, type TimecodeFormat } from '../time';

export interface SpellCheckEntry {
  pattern: string;
  replacement: string;
  language: 'zh' | 'en';
  description?: string;
}

export interface SpellCheckResult {
  id: string;
  clipId: string;
  start: number;
  originalText: string;
  matchedWord: string;
  suggestions: string[];
  startIndex: number;
  endIndex: number;
}

export interface SpellCheckScanInput {
  clipId: string;
  start: number;
  text: string;
}

export interface SpellCheckReplaceInput {
  clipId: string;
  startIndex: number;
  endIndex: number;
  replacement: string;
}

export const CHINESE_SPELL_CHECK_DICT: SpellCheckEntry[] = [
  { pattern: '在也不是', replacement: '再也不是', language: 'zh', description: '"在/再"易混淆' },
  { pattern: '在三', replacement: '再三', language: 'zh', description: '"在/再"易混淆' },
  { pattern: '在次', replacement: '再次', language: 'zh', description: '"在/再"易混淆' },
  { pattern: '在来', replacement: '再来', language: 'zh', description: '"在/再"易混淆' },
  { pattern: '在说', replacement: '再说', language: 'zh', description: '"在/再"易混淆' },
  { pattern: '在见', replacement: '再见', language: 'zh', description: '"在/再"易混淆' },
  { pattern: '己经', replacement: '已经', language: 'zh', description: '"己/已"易混淆' },
  { pattern: '以经', replacement: '已经', language: 'zh', description: '同音字错误' },
  { pattern: '即然', replacement: '既然', language: 'zh', description: '"即/既"易混淆' },
  { pattern: '既使', replacement: '即使', language: 'zh', description: '"即/既"易混淆' },
  { pattern: '很的', replacement: '狠的', language: 'zh', description: '同音字错误' },
  { pattern: '做的好', replacement: '做得好', language: 'zh', description: '得/的地用法' },
  { pattern: '走的快', replacement: '走得快', language: 'zh', description: '得/的地用法' },
  { pattern: '飞的高', replacement: '飞得高', language: 'zh', description: '得/的地用法' },
  { pattern: '其它', replacement: '其他', language: 'zh', description: '规范用词' },
  { pattern: '装潢', replacement: '装璜', language: 'zh', description: '易混词（注：装潢为正确，此处按需求保留）' },
];

export const ENGLISH_SPELL_CHECK_DICT: SpellCheckEntry[] = [
  { pattern: 'teh', replacement: 'the', language: 'en' },
  { pattern: 'adn', replacement: 'and', language: 'en' },
  { pattern: 'taht', replacement: 'that', language: 'en' },
  { pattern: 'thier', replacement: 'their', language: 'en' },
  { pattern: 'recieve', replacement: 'receive', language: 'en' },
  { pattern: 'occured', replacement: 'occurred', language: 'en' },
  { pattern: 'seperate', replacement: 'separate', language: 'en' },
  { pattern: 'definately', replacement: 'definitely', language: 'en' },
  { pattern: 'accomodate', replacement: 'accommodate', language: 'en' },
  { pattern: 'occurence', replacement: 'occurrence', language: 'en' },
  { pattern: 'untill', replacement: 'until', language: 'en' },
  { pattern: 'wierd', replacement: 'weird', language: 'en' },
  { pattern: 'lenght', replacement: 'length', language: 'en' },
  { pattern: 'widht', replacement: 'width', language: 'en' },
  { pattern: 'heigth', replacement: 'height', language: 'en' },
  { pattern: 'acheive', replacement: 'achieve', language: 'en' },
  { pattern: 'beleive', replacement: 'believe', language: 'en' },
  { pattern: 'foriegn', replacement: 'foreign', language: 'en' },
  { pattern: 'goverment', replacement: 'government', language: 'en' },
  { pattern: 'neccessary', replacement: 'necessary', language: 'en' },
];

export const DEFAULT_SPELL_CHECK_DICT: SpellCheckEntry[] = [...CHINESE_SPELL_CHECK_DICT, ...ENGLISH_SPELL_CHECK_DICT];

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function scanSubtitleSpelling(
  inputs: SpellCheckScanInput[],
  dictionary: SpellCheckEntry[] = DEFAULT_SPELL_CHECK_DICT,
  glossary: string[] = [],
): SpellCheckResult[] {
  const glossarySet = new Set(glossary.map((term) => term.toLowerCase()));
  const results: SpellCheckResult[] = [];

  for (const input of inputs) {
    const text = input.text ?? '';
    for (const entry of dictionary) {
      const regex = new RegExp(escapeRegExp(entry.pattern), entry.language === 'en' ? 'gi' : 'g');
      let match: RegExpExecArray | null;
      while ((match = regex.exec(text)) !== null) {
        const matchedWord = match[0];
        if (glossarySet.has(matchedWord.toLowerCase())) {
          continue;
        }
        results.push({
          id: `${input.clipId}:${match.index}:${entry.pattern}`,
          clipId: input.clipId,
          start: input.start,
          originalText: text,
          matchedWord,
          suggestions: [entry.replacement],
          startIndex: match.index,
          endIndex: match.index + matchedWord.length,
        });
      }
    }
  }

  return results.sort((a, b) => a.start - b.start || a.startIndex - b.startIndex);
}

export function applySpellCheckReplacement(text: string, result: SpellCheckResult, replacement: string): string {
  if (result.startIndex < 0 || result.startIndex >= text.length) {
    return text;
  }
  return text.slice(0, result.startIndex) + replacement + text.slice(result.endIndex);
}

export function buildSpellCheckReplacement(text: string, replaceInputs: SpellCheckReplaceInput[]): string {
  let result = text;
  const sorted = [...replaceInputs].sort((a, b) => b.startIndex - a.startIndex);
  for (const input of sorted) {
    if (input.startIndex < 0 || input.startIndex > result.length) {
      continue;
    }
    result = result.slice(0, input.startIndex) + input.replacement + result.slice(input.endIndex);
  }
  return result;
}

export function serializeSpellCheckReportCsv(
  results: SpellCheckResult[],
  options: { fps?: number; timecodeFormat?: TimecodeFormat } = {},
): string {
  const rows = [['timecode', 'clip_id', 'matched_word', 'suggestion', 'original_text']];
  for (const result of results) {
    rows.push([
      secondsToTimecode(result.start, options.fps ?? 30, options.timecodeFormat ?? 'ndf'),
      result.clipId,
      result.matchedWord,
      result.suggestions[0] ?? '',
      result.originalText,
    ]);
  }
  return rows.map((row) => row.map(escapeCsvCell).join(',')).join('\n') + '\n';
}

function escapeCsvCell(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}
