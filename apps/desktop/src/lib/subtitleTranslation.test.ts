import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { acceptTranslationTOS, translateSubtitleItems } from './subtitleTranslation';

describe('subtitle translation API client', () => {
  beforeEach(() => {
    const storage = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: vi.fn((key: string) => storage.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => {
        storage.set(key, value);
      }),
      removeItem: vi.fn((key: string) => {
        storage.delete(key);
      }),
      clear: vi.fn(() => {
        storage.clear();
      })
    });
    acceptTranslationTOS();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('requires terms acceptance before contacting translation providers', async () => {
    localStorage.clear();
    const fetchMock = vi.fn();

    await expect(translateSubtitleItems([{ id: 'cue-a', text: 'Hello' }], { provider: 'deepl', apiKey: 'deepl-key', targetLanguage: 'ZH' }, fetchMock as typeof fetch)).rejects.toThrow(
      'TRANSLATION_TOS_NOT_ACCEPTED'
    );

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends DeepL requests in batches of at most 50', async () => {
    const items = Array.from({ length: 51 }, (_, index) => ({ id: `cue-${index}`, text: `Line ${index}` }));
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = init?.body as URLSearchParams;
      const texts = body.getAll('text');
      return new Response(JSON.stringify({ translations: texts.map((text) => ({ text: `${text} ZH` })) }), { status: 200 });
    });

    const result = await translateSubtitleItems(items, { provider: 'deepl', apiKey: 'deepl-key', targetLanguage: 'ZH' }, fetchMock as typeof fetch);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect((fetchMock.mock.calls[0][1]?.body as URLSearchParams).getAll('text')).toHaveLength(50);
    expect(result.at(-1)?.translatedText).toBe('Line 50 ZH');
  });

  it('sends Google requests with q array and target language', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { q: string[]; target: string };
      return new Response(JSON.stringify({ data: { translations: body.q.map((text) => ({ translatedText: `${text} JA` })) } }), { status: 200 });
    });

    const result = await translateSubtitleItems([{ id: 'cue-a', text: 'Hello' }], { provider: 'google', apiKey: 'google-key', targetLanguage: 'JA' }, fetchMock as typeof fetch);

    expect(String(fetchMock.mock.calls[0][0])).toContain('key=google-key');
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toMatchObject({ q: ['Hello'], target: 'JA', format: 'text' });
    expect(result).toEqual([{ id: 'cue-a', text: 'Hello', translatedText: 'Hello JA' }]);
  });

  it('reports progress after each translated cue', async () => {
    const progress: Array<[number, number]> = [];
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const texts = (init?.body as URLSearchParams).getAll('text');
      return new Response(JSON.stringify({ translations: texts.map((text) => ({ text })) }), { status: 200 });
    });

    await translateSubtitleItems(
      [
        { id: 'cue-a', text: 'A' },
        { id: 'cue-b', text: 'B' }
      ],
      { provider: 'deepl', apiKey: 'key', targetLanguage: 'ZH' },
      fetchMock as typeof fetch,
      (completed, total) => progress.push([completed, total])
    );

    expect(progress).toEqual([
      [0, 2],
      [1, 2],
      [2, 2]
    ]);
  });

  it('throws when response count does not match request count', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ translations: [{ text: 'Only one' }] }), { status: 200 }));

    await expect(
      translateSubtitleItems(
        [
          { id: 'cue-a', text: 'A' },
          { id: 'cue-b', text: 'B' }
        ],
        { provider: 'deepl', apiKey: 'key', targetLanguage: 'ZH' },
        fetchMock as typeof fetch
      )
    ).rejects.toThrow('response count');
  });
});
