export interface GlossaryTerm {
  original: string;
  type: 'person' | 'product' | 'place' | 'organization' | 'terminology' | 'slang' | 'other';
  translation?: string;
}

export interface SubtitleGlossary {
  terms: GlossaryTerm[];
}

export function buildSubtitleGlossarySystemPrompt(): string {
  return [
    '你是一个专业的字幕翻译术语提取助手。用户会给你一条字幕轨的完整文本（含时间码）。',
    '请从中提取专有名词、人名、产品名、地名、行业术语、俚语和对话语气词。',
    '返回严格JSON格式:',
    '{',
    '  "terms": [',
    '    {"original": "原词", "type": "person|product|place|organization|terminology|slang|other"}',
    '  ]',
    '}',
    '只返回JSON对象，不要其他内容。',
  ].join('\n');
}

export function buildGlossaryExtractionUserPrompt(
  subtitleLines: Array<{ index: number; time: string; text: string }>,
): string {
  const lines = ['字幕内容:'];
  for (const s of subtitleLines) {
    lines.push(`[${s.index}] ${s.time} ${s.text}`);
  }
  return lines.join('\n');
}

export function parseSubtitleGlossaryResponse(json: unknown): SubtitleGlossary {
  if (!json || typeof json !== 'object') return { terms: [] };
  const input = json as Record<string, unknown>;
  if (!Array.isArray(input.terms)) return { terms: [] };
  const validTypes = new Set(['person', 'product', 'place', 'organization', 'terminology', 'slang', 'other']);
  const terms: GlossaryTerm[] = [];
  for (const item of input.terms) {
    if (!item || typeof item !== 'object') continue;
    const entry = item as Record<string, unknown>;
    if (typeof entry.original !== 'string') continue;
    const original = entry.original.trim();
    if (!original) continue;
    const typeRaw = typeof entry.type === 'string' ? entry.type.trim().toLowerCase() : 'other';
    const type = validTypes.has(typeRaw) ? (typeRaw as GlossaryTerm['type']) : 'other';
    const translation = typeof entry.translation === 'string' ? entry.translation.trim() : undefined;
    terms.push({ original, type, translation });
  }
  return { terms };
}

export function buildContextualTranslationSystemPrompt(
  glossary: GlossaryTerm[],
  targetLanguage: string,
  speakerStyle?: string,
): string {
  const lines = [
    `你是一个专业的字幕翻译助手。请将以下字幕翻译为${targetLanguage}。`,
    '翻译要求:',
    '- 保持对话语气和风格一致',
    '- 字幕翻译要简洁自然，适合在屏幕上阅读',
    '- 时间码格式保持不变',
  ];
  if (speakerStyle) {
    lines.push(`- 说话人风格: ${speakerStyle}`);
  }
  if (glossary.length > 0) {
    lines.push('');
    lines.push('术语表（翻译时请保持一致）:');
    for (const term of glossary) {
      const translated = term.translation ? ` → ${term.translation}` : '';
      lines.push(`  ${term.original} [${term.type}]${translated}`);
    }
  }
  lines.push('');
  lines.push('返回严格JSON数组，每个元素包含:');
  lines.push('{"index": 序号, "translatedText": "翻译后的文本"}');
  lines.push('只返回JSON数组，不要其他内容。');
  return lines.join('\n');
}

export interface ContextualTranslationItem {
  index: number;
  translatedText: string;
}

export function parseContextualTranslationResponse(json: unknown): ContextualTranslationItem[] {
  if (!Array.isArray(json)) return [];
  return json
    .filter(
      (item): item is Record<string, unknown> =>
        item !== null &&
        typeof item === 'object' &&
        typeof (item as Record<string, unknown>).index === 'number' &&
        typeof (item as Record<string, unknown>).translatedText === 'string',
    )
    .map((item) => ({
      index: Math.max(0, Math.round(item.index as number)),
      translatedText: (item.translatedText as string).trim(),
    }))
    .filter((item) => item.translatedText.length > 0);
}

export interface TranslationComparison {
  index: number;
  original: string;
  withoutContext: string;
  withContext: string;
  hasDifference: boolean;
}

/**
 * Compare two translation versions to highlight differences.
 */
export function compareTranslationVersions(
  originalTexts: string[],
  withoutContext: string[],
  withContext: string[],
): TranslationComparison[] {
  const maxLen = Math.max(originalTexts.length, withoutContext.length, withContext.length);
  const results: TranslationComparison[] = [];
  for (let i = 0; i < maxLen; i++) {
    const original = originalTexts[i] ?? '';
    const noCtx = withoutContext[i] ?? '';
    const ctx = withContext[i] ?? '';
    results.push({
      index: i,
      original,
      withoutContext: noCtx,
      withContext: ctx,
      hasDifference: noCtx !== ctx,
    });
  }
  return results;
}

export function calculateContextualTranslationBatches(subtitleCount: number, maxBatchSize = 50): number[] {
  if (subtitleCount <= 0) return [];
  const batches: number[] = [];
  let remaining = subtitleCount;
  while (remaining > 0) {
    const count = Math.min(maxBatchSize, remaining);
    batches.push(count);
    remaining -= count;
  }
  return batches;
}
