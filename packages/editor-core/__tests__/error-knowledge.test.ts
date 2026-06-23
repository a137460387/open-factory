import { describe, expect, it } from 'vitest';
import {
  matchErrorKnowledge,
  getTopMatches,
  buildFeedbackMap,
  createDefaultKnowledgeStore,
  addFeedback,
  mergeKnowledgeUpdate,
  normalizeEntry,
  filterEntriesByMinCount,
  BUILT_IN_ERROR_ENTRIES,
  type ErrorKnowledgeEntry,
  type ErrorFeedbackRecord,
} from '../src';

describe('error knowledge base', () => {
  it('has at least 15 built-in entries', () => {
    expect(BUILT_IN_ERROR_ENTRIES.length).toBeGreaterThanOrEqual(15);
  });

  it('every built-in entry has at least one pattern', () => {
    for (const entry of BUILT_IN_ERROR_ENTRIES) {
      expect(entry.patterns.length).toBeGreaterThanOrEqual(1);
      expect(entry.id).toBeTruthy();
      expect(entry.label).toBeTruthy();
      expect(entry.causes.length).toBeGreaterThanOrEqual(1);
      expect(entry.solutions.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('every built-in entry has a valid category', () => {
    const validCategories = [
      'codec', 'path', 'disk', 'font', 'permission', 'network', 'memory',
      'ffmpeg-version', 'input-format', 'output-format', 'hardware', 'timeout',
      'subtitles', 'audio', 'general',
    ];
    for (const entry of BUILT_IN_ERROR_ENTRIES) {
      expect(validCategories).toContain(entry.category);
    }
  });
});

describe('matchErrorKnowledge', () => {
  const entries = BUILT_IN_ERROR_ENTRIES;

  it('matches codec unsupported errors', () => {
    const matches = matchErrorKnowledge('Unknown encoder libsvtav1', entries);
    expect(matches.length).toBeGreaterThanOrEqual(1);
    expect(matches[0].entry.category).toBe('codec');
  });

  it('matches path errors', () => {
    const matches = matchErrorKnowledge("No such file or directory 'C:\\video\\out.mp4'", entries);
    expect(matches.length).toBeGreaterThanOrEqual(1);
    expect(matches[0].entry.category).toBe('path');
  });

  it('matches disk space errors', () => {
    const matches = matchErrorKnowledge('No space left on device', entries);
    expect(matches.length).toBeGreaterThanOrEqual(1);
    expect(matches[0].entry.category).toBe('disk');
  });

  it('matches permission denied errors', () => {
    const matches = matchErrorKnowledge('Permission denied: /output/video.mp4', entries);
    expect(matches.length).toBeGreaterThanOrEqual(1);
    expect(matches[0].entry.category).toBe('permission');
  });

  it('matches corrupt source errors', () => {
    const matches = matchErrorKnowledge('Invalid data found when processing input', entries);
    expect(matches.length).toBeGreaterThanOrEqual(1);
    expect(matches[0].entry.category).toBe('input-format');
  });

  it('matches font missing errors', () => {
    const matches = matchErrorKnowledge('Fontconfig: cannot open shared object file', entries);
    expect(matches.length).toBeGreaterThanOrEqual(1);
    expect(matches[0].entry.category).toBe('font');
  });

  it('matches memory OOM errors', () => {
    const matches = matchErrorKnowledge('Cannot allocate memory', entries);
    expect(matches.length).toBeGreaterThanOrEqual(1);
    expect(matches[0].entry.category).toBe('memory');
  });

  it('matches hardware acceleration errors', () => {
    const matches = matchErrorKnowledge('NVENC error: device not found', entries);
    expect(matches.length).toBeGreaterThanOrEqual(1);
    expect(matches[0].entry.category).toBe('hardware');
  });

  it('matches network storage errors', () => {
    const matches = matchErrorKnowledge('Network is unreachable', entries);
    expect(matches.length).toBeGreaterThanOrEqual(1);
    expect(matches[0].entry.category).toBe('network');
  });

  it('matches FFmpeg version errors', () => {
    const matches = matchErrorKnowledge('Unrecognized option \'--new-flag\'', entries);
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it('matches subtitle render errors', () => {
    const matches = matchErrorKnowledge('drawtext error: cannot render font', entries);
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it('matches audio encode errors', () => {
    const matches = matchErrorKnowledge('sample rate 22050 not supported', entries);
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it('returns empty for unrecognized errors', () => {
    const matches = matchErrorKnowledge('Something completely unrelated xyz', entries);
    expect(matches).toHaveLength(0);
  });

  it('returns empty for empty stderr', () => {
    expect(matchErrorKnowledge('', entries)).toHaveLength(0);
  });

  it('can match multiple patterns at once', () => {
    const matches = matchErrorKnowledge('Unknown encoder h265_nvenc; No space left on device', entries);
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });

  it('sorts by score descending', () => {
    const matches = matchErrorKnowledge('Unknown encoder libsvtav1; No space left on device', entries);
    for (let i = 1; i < matches.length; i++) {
      expect(matches[i - 1].score).toBeGreaterThanOrEqual(matches[i].score);
    }
  });

  it('scores entries with more matched patterns higher', () => {
    const singleMatch = matchErrorKnowledge('Unknown encoder', entries);
    const doubleMatch = matchErrorKnowledge('Unknown encoder; codec not supported; not compatible with', entries);
    const codecSingle = singleMatch.find((m) => m.entry.id === 'codec-unsupported');
    const codecDouble = doubleMatch.find((m) => m.entry.id === 'codec-unsupported');
    if (codecSingle && codecDouble) {
      expect(codecDouble.score).toBeGreaterThanOrEqual(codecSingle.score);
    }
  });
});

describe('getTopMatches', () => {
  const entries = BUILT_IN_ERROR_ENTRIES;

  it('returns top 3 by default', () => {
    const top = getTopMatches('Unknown encoder; No space left; Permission denied', entries);
    expect(top.length).toBeLessThanOrEqual(3);
  });

  it('respects custom limit', () => {
    const top = getTopMatches('Unknown encoder; No space left; Permission denied; Cannot allocate memory', entries, undefined, 2);
    expect(top.length).toBeLessThanOrEqual(2);
  });

  it('returns empty for no matches', () => {
    expect(getTopMatches('no error here', entries)).toHaveLength(0);
  });

  it('top match has highest score', () => {
    const top = getTopMatches('No space left on device; Permission denied', entries);
    if (top.length >= 2) {
      expect(top[0].score).toBeGreaterThanOrEqual(top[1].score);
    }
  });
});

describe('buildFeedbackMap', () => {
  it('returns empty map for empty records', () => {
    expect(buildFeedbackMap([]).size).toBe(0);
  });

  it('positive feedback increases weight', () => {
    const records: ErrorFeedbackRecord[] = [
      { entryId: 'codec-unsupported', helpful: true, timestamp: Date.now() },
      { entryId: 'codec-unsupported', helpful: true, timestamp: Date.now() },
    ];
    const map = buildFeedbackMap(records);
    expect(map.get('codec-unsupported')).toBeGreaterThan(0);
  });

  it('negative feedback decreases weight', () => {
    const records: ErrorFeedbackRecord[] = [
      { entryId: 'disk-space', helpful: false, timestamp: Date.now() },
      { entryId: 'disk-space', helpful: false, timestamp: Date.now() },
      { entryId: 'disk-space', helpful: false, timestamp: Date.now() },
    ];
    const map = buildFeedbackMap(records);
    expect(map.get('disk-space')).toBeLessThan(0);
  });

  it('feedback influences match ranking', () => {
    const entries = BUILT_IN_ERROR_ENTRIES;
    const stderr = 'Unknown encoder; No space left';
    const noFeedback = getTopMatches(stderr, entries);

    const positiveRecords: ErrorFeedbackRecord[] = Array.from({ length: 10 }, () => ({
      entryId: 'disk-space',
      helpful: true,
      timestamp: Date.now(),
    }));
    const feedbackMap = buildFeedbackMap(positiveRecords);
    const withFeedback = getTopMatches(stderr, entries, feedbackMap);

    const diskNoFeedback = noFeedback.findIndex((m) => m.entry.id === 'disk-space');
    const diskWithFeedback = withFeedback.findIndex((m) => m.entry.id === 'disk-space');
    if (diskNoFeedback >= 0 && diskWithFeedback >= 0) {
      expect(diskWithFeedback).toBeLessThanOrEqual(diskNoFeedback);
    }
  });

  it('ignores old feedback outside decay window', () => {
    const oldTimestamp = Date.now() - 100 * 24 * 60 * 60 * 1000;
    const records: ErrorFeedbackRecord[] = [
      { entryId: 'codec-unsupported', helpful: true, timestamp: oldTimestamp },
    ];
    const map = buildFeedbackMap(records);
    expect(map.get('codec-unsupported')).toBeUndefined();
  });
});

describe('createDefaultKnowledgeStore', () => {
  it('creates store with all built-in entries', () => {
    const store = createDefaultKnowledgeStore();
    expect(store.entries.length).toBeGreaterThanOrEqual(15);
    expect(store.feedback).toHaveLength(0);
    expect(store.version).toBe(1);
  });
});

describe('addFeedback', () => {
  it('appends feedback record', () => {
    const store = createDefaultKnowledgeStore();
    const updated = addFeedback(store, 'codec-unsupported', true);
    expect(updated.feedback).toHaveLength(1);
    expect(updated.feedback[0].entryId).toBe('codec-unsupported');
    expect(updated.feedback[0].helpful).toBe(true);
  });

  it('preserves existing feedback', () => {
    const store = createDefaultKnowledgeStore();
    const step1 = addFeedback(store, 'codec-unsupported', true);
    const step2 = addFeedback(step1, 'disk-space', false);
    expect(step2.feedback).toHaveLength(2);
  });
});

describe('mergeKnowledgeUpdate', () => {
  it('adds new remote entries', () => {
    const store = createDefaultKnowledgeStore();
    const remote: ErrorKnowledgeEntry[] = [{
      id: 'custom-error-1',
      category: 'general',
      patterns: ['custom error pattern'],
      label: '自定义错误',
      causes: ['自定义原因'],
      solutions: ['自定义方案'],
      links: [],
      baseWeight: 0.7,
    }];
    const merged = mergeKnowledgeUpdate(store, remote, 'gist-test');
    expect(merged.entries.length).toBe(store.entries.length + 1);
    expect(merged.updateSource).toBe('gist-test');
  });

  it('updates existing entries by id', () => {
    const store = createDefaultKnowledgeStore();
    const remote: ErrorKnowledgeEntry[] = [{
      id: 'codec-unsupported',
      category: 'codec',
      patterns: ['Updated pattern'],
      label: '更新后的标签',
      causes: ['更新原因'],
      solutions: ['更新方案'],
      links: [],
      baseWeight: 1.0,
    }];
    const merged = mergeKnowledgeUpdate(store, remote, 'gist-test');
    const updated = merged.entries.find((e) => e.id === 'codec-unsupported');
    expect(updated?.patterns).toEqual(['Updated pattern']);
    expect(updated?.label).toBe('更新后的标签');
  });

  it('ignores entries with empty id or patterns', () => {
    const store = createDefaultKnowledgeStore();
    const remote: ErrorKnowledgeEntry[] = [
      { id: '', category: 'general', patterns: ['x'], label: 'x', causes: [], solutions: [], links: [], baseWeight: 0.5 },
      { id: 'valid', category: 'general', patterns: [], label: 'x', causes: [], solutions: [], links: [], baseWeight: 0.5 },
    ];
    const merged = mergeKnowledgeUpdate(store, remote, 'test');
    expect(merged.entries.length).toBe(store.entries.length);
  });

  it('returns local store unchanged when remote is empty', () => {
    const store = createDefaultKnowledgeStore();
    const merged = mergeKnowledgeUpdate(store, [], 'test');
    expect(merged).toEqual(store);
  });
});

describe('normalizeEntry', () => {
  it('fills defaults for missing fields', () => {
    const entry = normalizeEntry({});
    expect(entry.id).toBeTruthy();
    expect(entry.category).toBe('general');
    expect(entry.baseWeight).toBeGreaterThanOrEqual(0);
    expect(entry.baseWeight).toBeLessThanOrEqual(2);
  });

  it('clamps baseWeight to [0, 2]', () => {
    expect(normalizeEntry({ id: 'x', baseWeight: -1 }).baseWeight).toBe(0);
    expect(normalizeEntry({ id: 'x', baseWeight: 5 }).baseWeight).toBe(2);
  });

  it('filters out empty patterns', () => {
    const entry = normalizeEntry({ id: 'x', patterns: ['valid', '', '  ', 'also-valid'] });
    expect(entry.patterns).toEqual(['valid', 'also-valid']);
  });

  it('normalizes unknown category to general', () => {
    expect(normalizeEntry({ id: 'x', category: 'invalid' as any }).category).toBe('general');
  });
});

describe('filterEntriesByMinCount', () => {
  it('returns true when count >= min', () => {
    expect(filterEntriesByMinCount(BUILT_IN_ERROR_ENTRIES, 15)).toBe(true);
  });

  it('returns false when count < min', () => {
    expect(filterEntriesByMinCount(BUILT_IN_ERROR_ENTRIES, 999)).toBe(false);
  });
});
