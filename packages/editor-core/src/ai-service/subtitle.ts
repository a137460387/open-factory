import type { AISubtitlePolishItem } from './types';

export function calculateSubtitlePolishBatchSplit(total: number, batchSize = 50): number[] {
  if (total <= 0) {
    return [];
  }
  const batches: number[] = [];
  let remaining = total;
  while (remaining > 0) {
    const count = Math.min(batchSize, remaining);
    batches.push(count);
    remaining -= count;
  }
  return batches;
}

export function parseSubtitlePolishResponse(json: unknown): AISubtitlePolishItem[] {
  if (!Array.isArray(json)) {
    return [];
  }
  return json
    .filter(
      (item) =>
        item &&
        typeof item === 'object' &&
        typeof (item as AISubtitlePolishItem).index === 'number' &&
        typeof (item as AISubtitlePolishItem).text === 'string',
    )
    .map((item) => ({
      index: Math.max(0, Math.round((item as AISubtitlePolishItem).index)),
      text: ((item as AISubtitlePolishItem).text || '').trim(),
    }))
    .filter((item) => item.text.length > 0);
}

export const FILLER_WORDS_ZH = ['嗯', '啊', '那个', '就是', '然后'];

export function removeFillerWords(text: string, fillers: string[] = FILLER_WORDS_ZH): string {
  let result = text;
  for (const filler of fillers) {
    result = result.replace(new RegExp(`${filler}(?=[，。！？、\\s]|$)`, 'g'), '');
  }
  return result
    .replace(/^[，。！？、\s]+/, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}
