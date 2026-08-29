// 覆盖目标：apps/desktop/src/components/SmartRoughCut/semantic-suggestion-adoption-log.ts
// 策略：纯函数直调 + jsdom localStorage（成熟测试模式 4）。锁定：追加写入
// 与读取往返、按类型/时间窗聚合、封顶 500 截旧、损坏 JSON 与非数组载荷
// 容错（→ 空数组起点）、localStorage 异常静默（记录失败不抛出）。
// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  aggregateSuggestionAdoptions,
  getSuggestionAdoptions,
  recordSuggestionAdoption,
} from './semantic-suggestion-adoption-log';

const STORAGE_KEY = 'open-factory:semantic-suggestion-adoptions';

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('semantic-suggestion-adoption-log record and read', () => {
  it('appends adoption events with source and timestamp and reads them back', () => {
    recordSuggestionAdoption('narrative', 1_000);
    recordSuggestionAdoption('head-trim', 2_000);

    expect(getSuggestionAdoptions()).toEqual([
      { source: 'narrative', ts: 1_000 },
      { source: 'head-trim', ts: 2_000 },
    ]);
    expect(localStorage.getItem(STORAGE_KEY)).toContain('"source":"head-trim"');
  });

  it('returns an empty array when nothing has been recorded', () => {
    expect(getSuggestionAdoptions()).toEqual([]);
  });
});

describe('semantic-suggestion-adoption-log aggregation', () => {
  it('aggregates counts per source type', () => {
    recordSuggestionAdoption('narrative', 1_000);
    recordSuggestionAdoption('narrative', 2_000);
    recordSuggestionAdoption('tail-trim', 3_000);

    expect(aggregateSuggestionAdoptions()).toEqual({ narrative: 2, 'tail-trim': 1 });
  });

  it('filters entries by the sinceTs time window (含端点)', () => {
    recordSuggestionAdoption('narrative', 1_000);
    recordSuggestionAdoption('head-trim', 2_000);
    recordSuggestionAdoption('tail-trim', 3_000);

    expect(aggregateSuggestionAdoptions({ sinceTs: 2_000 })).toEqual({ 'head-trim': 1, 'tail-trim': 1 });
    expect(aggregateSuggestionAdoptions({ sinceTs: 3_000 })).toEqual({ 'tail-trim': 1 });
  });
});

describe('semantic-suggestion-adoption-log cap and robustness', () => {
  it('caps the log at 500 entries and drops the oldest', () => {
    for (let index = 0; index < 505; index += 1) {
      recordSuggestionAdoption(index % 2 === 0 ? 'head-trim' : 'tail-trim', index);
    }

    const entries = getSuggestionAdoptions();
    expect(entries).toHaveLength(500);
    // 505 条截掉最旧 5 条（ts 0-4）；ts 5 为奇数 index → tail-trim，ts 504 为偶数 → head-trim
    expect(entries[0]).toEqual({ source: 'tail-trim', ts: 5 });
    expect(entries[499]).toEqual({ source: 'head-trim', ts: 504 });
  });

  it('treats corrupted JSON as an empty log and resumes accumulation', () => {
    localStorage.setItem(STORAGE_KEY, '{not json');
    expect(getSuggestionAdoptions()).toEqual([]);

    recordSuggestionAdoption('narrative', 1_000);
    expect(getSuggestionAdoptions()).toEqual([{ source: 'narrative', ts: 1_000 }]);
  });

  it('treats a non-array or malformed payload as an empty log', () => {
    localStorage.setItem(STORAGE_KEY, '{"source":"narrative"}');
    expect(getSuggestionAdoptions()).toEqual([]);

    localStorage.setItem(STORAGE_KEY, '[null, 42, {"source":"narrative","ts":"x"}, {"source":"climax","ts":1}]');
    expect(getSuggestionAdoptions()).toEqual([]);
  });

  it('silently ignores localStorage failures without throwing', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('quota exceeded');
    });

    expect(() => recordSuggestionAdoption('narrative')).not.toThrow();
    expect(getSuggestionAdoptions()).toEqual([]);
    expect(aggregateSuggestionAdoptions()).toEqual({});
  });
});
