import { buildSubtitleTranslationBatches, type Clip } from '@open-factory/editor-core';
import type { TranslationSettings } from '../store/translationSettingsStore';

export interface SubtitleTranslationItem {
  id: string;
  text: string;
}

export interface TranslatedSubtitleItem extends SubtitleTranslationItem {
  translatedText: string;
}

export type TranslationProgress = (completed: number, total: number) => void;

type FetchLike = typeof fetch;

function hasAcceptedTranslationTOS(): boolean {
  return localStorage.getItem('translation_tos_accepted') === 'true';
}

export function acceptTranslationTOS(): void {
  localStorage.setItem('translation_tos_accepted', 'true');
}

export async function translateSubtitleItems(
  items: SubtitleTranslationItem[],
  settings: TranslationSettings,
  fetchImpl: FetchLike = fetch,
  onProgress?: TranslationProgress
): Promise<TranslatedSubtitleItem[]> {
  const batches = buildSubtitleTranslationBatches(items, 50);
  const translated: TranslatedSubtitleItem[] = [];
  let completed = 0;
  onProgress?.(completed, items.length);
  for (const batch of batches) {
    const texts = batch.cues.map((cue) => cue.text);
    const batchTexts = settings.provider === 'google' ? await translateWithGoogle(texts, settings, fetchImpl) : await translateWithDeepL(texts, settings, fetchImpl);
    if (batchTexts.length !== batch.cues.length) {
      throw new Error('Translation response count did not match request count');
    }
    batch.cues.forEach((cue, index) => {
      translated.push({
        id: cue.id,
        text: cue.text,
        translatedText: batchTexts[index]
      });
      completed += 1;
      onProgress?.(completed, items.length);
    });
  }
  return translated;
}

export function subtitleClipsToTranslationItems(clips: Array<Extract<Clip, { type: 'subtitle' }>>): SubtitleTranslationItem[] {
  return clips
    .slice()
    .sort((left, right) => left.start - right.start || left.id.localeCompare(right.id))
    .map((clip) => ({
      id: clip.id,
      text: clip.text
    }));
}

async function translateWithDeepL(texts: string[], settings: TranslationSettings, fetchImpl: FetchLike): Promise<string[]> {
  if (!hasAcceptedTranslationTOS()) {
    throw new Error('TRANSLATION_TOS_NOT_ACCEPTED');
  }
  const apiKey = requireTranslationApiKey(settings);
  const body = new URLSearchParams();
  for (const text of texts) {
    body.append('text', text);
  }
  body.set('target_lang', settings.targetLanguage);
  const response = await fetchImpl('https://api-free.deepl.com/v2/translate', {
    method: 'POST',
    headers: {
      Authorization: `DeepL-Auth-Key ${apiKey}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body
  });
  if (!response.ok) {
    throw new Error(`DeepL translation failed: ${response.status}`);
  }
  const payload = (await response.json()) as { translations?: Array<{ text?: unknown }> };
  return (payload.translations ?? []).map((item) => String(item.text ?? ''));
}

async function translateWithGoogle(texts: string[], settings: TranslationSettings, fetchImpl: FetchLike): Promise<string[]> {
  if (!hasAcceptedTranslationTOS()) {
    throw new Error('TRANSLATION_TOS_NOT_ACCEPTED');
  }
  const apiKey = requireTranslationApiKey(settings);
  const response = await fetchImpl(`https://translation.googleapis.com/language/translate/v2?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      q: texts,
      target: settings.targetLanguage,
      format: 'text'
    })
  });
  if (!response.ok) {
    throw new Error(`Google translation failed: ${response.status}`);
  }
  const payload = (await response.json()) as { data?: { translations?: Array<{ translatedText?: unknown }> } };
  return (payload.data?.translations ?? []).map((item) => String(item.translatedText ?? ''));
}

function requireTranslationApiKey(settings: TranslationSettings): string {
  const apiKey = settings.apiKey.trim();
  if (!apiKey) {
    throw new Error('TRANSLATION_API_KEY_REQUIRED');
  }
  return apiKey;
}
