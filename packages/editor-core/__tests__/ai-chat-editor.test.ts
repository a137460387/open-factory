import { describe, expect, it } from 'vitest';
import {
  CHAT_ACTION_WHITELIST,
  CHAT_HISTORY_MAX,
  ChatHistory,
  buildChatSystemPrompt,
  buildTimelineContext,
  describeChatCommand,
  findClipInTimeline,
  getAllClipIds,
  parseChatAIResponse,
  safeParseChatResponse,
  validateChatAction,
  type ChatCommand
} from '../src/ai-chat-editor';
import { makeVideoClip, makeTimeline, makeProject } from './test-utils';

describe('CHAT_ACTION_WHITELIST', () => {
  it('contains exactly 11 allowed actions', () => {
    expect(CHAT_ACTION_WHITELIST.size).toBe(11);
  });

  it('includes all expected actions', () => {
    const expected = [
      'setSpeed', 'setVolume', 'delete', 'split', 'trim',
      'deleteAllSilence', 'setAllClipsSpeed', 'applyColorPreset',
      'jumpTo', 'selectClip', 'query'
    ];
    for (const action of expected) {
      expect(CHAT_ACTION_WHITELIST.has(action as any)).toBe(true);
    }
  });

  it('rejects actions not in the whitelist', () => {
    const result = validateChatAction({ action: 'hackTimeline' });
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('不允许的操作类型');
  });

  it('rejects prompt injection attempts with custom action names', () => {
    const result = validateChatAction({ action: 'rm -rf /' });
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('不允许的操作类型');
  });
});

describe('validateChatAction', () => {
  it('rejects null/undefined input', () => {
    expect(validateChatAction(null).valid).toBe(false);
    expect(validateChatAction(undefined).valid).toBe(false);
  });

  it('rejects non-object input', () => {
    expect(validateChatAction('string').valid).toBe(false);
    expect(validateChatAction(42).valid).toBe(false);
  });

  it('rejects when action field is missing', () => {
    expect(validateChatAction({ clipId: 'x' }).valid).toBe(false);
  });

  it('validates setSpeed with valid params', () => {
    expect(validateChatAction({ action: 'setSpeed', clipId: 'c1', value: 0.5 }).valid).toBe(true);
  });

  it('rejects setSpeed with missing clipId', () => {
    expect(validateChatAction({ action: 'setSpeed', value: 0.5 }).valid).toBe(false);
  });

  it('rejects setSpeed with non-positive value', () => {
    expect(validateChatAction({ action: 'setSpeed', clipId: 'c1', value: 0 }).valid).toBe(false);
    expect(validateChatAction({ action: 'setSpeed', clipId: 'c1', value: -1 }).valid).toBe(false);
  });

  it('validates setVolume with valid range', () => {
    expect(validateChatAction({ action: 'setVolume', clipId: 'c1', value: 0 }).valid).toBe(true);
    expect(validateChatAction({ action: 'setVolume', clipId: 'c1', value: 1 }).valid).toBe(true);
    expect(validateChatAction({ action: 'setVolume', clipId: 'c1', value: 2 }).valid).toBe(true);
  });

  it('rejects setVolume outside 0-2 range', () => {
    expect(validateChatAction({ action: 'setVolume', clipId: 'c1', value: -0.1 }).valid).toBe(false);
    expect(validateChatAction({ action: 'setVolume', clipId: 'c1', value: 2.1 }).valid).toBe(false);
  });

  it('validates delete with clipId', () => {
    expect(validateChatAction({ action: 'delete', clipId: 'c1' }).valid).toBe(true);
    expect(validateChatAction({ action: 'delete' }).valid).toBe(false);
  });

  it('validates split with clipId and atTime', () => {
    expect(validateChatAction({ action: 'split', clipId: 'c1', atTime: 5 }).valid).toBe(true);
    expect(validateChatAction({ action: 'split', clipId: 'c1', atTime: -1 }).valid).toBe(false);
    expect(validateChatAction({ action: 'split', clipId: 'c1' }).valid).toBe(false);
  });

  it('validates trim with clipId, trimStart, trimEnd', () => {
    expect(validateChatAction({ action: 'trim', clipId: 'c1', trimStart: 1, trimEnd: 2 }).valid).toBe(true);
    expect(validateChatAction({ action: 'trim', clipId: 'c1', trimStart: -1, trimEnd: 2 }).valid).toBe(false);
    expect(validateChatAction({ action: 'trim', clipId: 'c1', trimStart: 1 }).valid).toBe(false);
  });

  it('validates deleteAllSilence (no extra params needed)', () => {
    expect(validateChatAction({ action: 'deleteAllSilence' }).valid).toBe(true);
  });

  it('validates setAllClipsSpeed with positive value', () => {
    expect(validateChatAction({ action: 'setAllClipsSpeed', value: 1.5 }).valid).toBe(true);
    expect(validateChatAction({ action: 'setAllClipsSpeed', value: 0 }).valid).toBe(false);
  });

  it('validates applyColorPreset with presetName', () => {
    expect(validateChatAction({ action: 'applyColorPreset', presetName: '电影' }).valid).toBe(true);
    expect(validateChatAction({ action: 'applyColorPreset', presetName: '' }).valid).toBe(false);
    expect(validateChatAction({ action: 'applyColorPreset' }).valid).toBe(false);
  });

  it('validates jumpTo with non-negative time', () => {
    expect(validateChatAction({ action: 'jumpTo', time: 0 }).valid).toBe(true);
    expect(validateChatAction({ action: 'jumpTo', time: 30 }).valid).toBe(true);
    expect(validateChatAction({ action: 'jumpTo', time: -1 }).valid).toBe(false);
  });

  it('validates selectClip with clipId', () => {
    expect(validateChatAction({ action: 'selectClip', clipId: 'c1' }).valid).toBe(true);
    expect(validateChatAction({ action: 'selectClip' }).valid).toBe(false);
  });

  it('validates query with answer field', () => {
    expect(validateChatAction({ action: 'query', answer: '有5个clip' }).valid).toBe(true);
    expect(validateChatAction({ action: 'query' }).valid).toBe(false);
  });
});

describe('parseChatAIResponse', () => {
  it('parses a single valid command', () => {
    const result = parseChatAIResponse({ action: 'setSpeed', clipId: 'c1', value: 0.5 });
    expect(result.commands).toHaveLength(1);
    expect(result.rejected).toHaveLength(0);
    expect(result.commands[0].action).toBe('setSpeed');
  });

  it('parses an array of valid commands', () => {
    const result = parseChatAIResponse([
      { action: 'setSpeed', clipId: 'c1', value: 0.5 },
      { action: 'setVolume', clipId: 'c2', value: 0.8 }
    ]);
    expect(result.commands).toHaveLength(2);
    expect(result.rejected).toHaveLength(0);
  });

  it('rejects illegal actions in mixed array', () => {
    const result = parseChatAIResponse([
      { action: 'setSpeed', clipId: 'c1', value: 0.5 },
      { action: 'deleteAll', clipId: 'c2' },
      { action: 'query', answer: 'hello' }
    ]);
    expect(result.commands).toHaveLength(2);
    expect(result.rejected).toHaveLength(1);
    expect(result.rejected[0]).toContain('不允许');
  });

  it('handles empty array', () => {
    const result = parseChatAIResponse([]);
    expect(result.commands).toHaveLength(0);
    expect(result.rejected).toHaveLength(0);
  });
});

describe('safeParseChatResponse', () => {
  it('parses valid JSON string', () => {
    const raw = JSON.stringify({ action: 'query', answer: '你好' });
    const result = safeParseChatResponse(raw);
    expect(result.commands).toHaveLength(1);
    expect(result.commands[0].action).toBe('query');
  });

  it('returns rejection for invalid JSON', () => {
    const result = safeParseChatResponse('not json');
    expect(result.commands).toHaveLength(0);
    expect(result.rejected).toHaveLength(1);
    expect(result.rejected[0]).toContain('不是有效的 JSON');
  });

  it('filters out illegal actions from parsed JSON', () => {
    const raw = JSON.stringify({ action: 'rm -rf', path: '/' });
    const result = safeParseChatResponse(raw);
    expect(result.commands).toHaveLength(0);
    expect(result.rejected).toHaveLength(1);
  });
});

describe('buildTimelineContext', () => {
  it('packs timeline state correctly', () => {
    const project = makeProject();
    const clip = makeVideoClip({ id: 'clip-1', start: 0, duration: 10 });
    project.timeline = makeTimeline([clip]);

    const ctx = buildTimelineContext(project);
    expect(ctx.clipCount).toBe(1);
    expect(ctx.trackCount).toBeGreaterThan(0);
    expect(ctx.clips[0].id).toBe('clip-1');
    expect(ctx.clips[0].duration).toBe(10);
  });

  it('includes selected clip info when selectedClipId is provided', () => {
    const project = makeProject();
    const clip = makeVideoClip({ id: 'clip-1', start: 0, duration: 10 });
    project.timeline = makeTimeline([clip]);

    const ctx = buildTimelineContext(project, 'clip-1');
    expect(ctx.selectedClipId).toBe('clip-1');
    expect(ctx.selectedClipInfo).toBeDefined();
    expect(ctx.selectedClipInfo!.name).toBe('Clip');
  });

  it('handles empty timeline', () => {
    const project = makeProject();
    project.timeline = makeTimeline([]);

    const ctx = buildTimelineContext(project);
    expect(ctx.clipCount).toBe(0);
    expect(ctx.totalDuration).toBe(0);
  });

  it('calculates total duration from max clip end', () => {
    const project = makeProject();
    const clip1 = makeVideoClip({ id: 'c1', start: 0, duration: 5 });
    const clip2 = makeVideoClip({ id: 'c2', start: 3, duration: 10 });
    project.timeline = makeTimeline([clip1, clip2]);

    const ctx = buildTimelineContext(project);
    expect(ctx.totalDuration).toBe(13);
  });
});

describe('buildChatSystemPrompt', () => {
  it('returns a non-empty string containing action descriptions', () => {
    const prompt = buildChatSystemPrompt();
    expect(prompt.length).toBeGreaterThan(0);
    expect(prompt).toContain('setSpeed');
    expect(prompt).toContain('setVolume');
    expect(prompt).toContain('delete');
    expect(prompt).toContain('split');
    expect(prompt).toContain('trim');
    expect(prompt).toContain('deleteAllSilence');
    expect(prompt).toContain('setAllClipsSpeed');
    expect(prompt).toContain('applyColorPreset');
    expect(prompt).toContain('jumpTo');
    expect(prompt).toContain('selectClip');
    expect(prompt).toContain('query');
  });
});

describe('describeChatCommand', () => {
  it('describes setSpeed', () => {
    const desc = describeChatCommand({ action: 'setSpeed', clipId: 'c1', value: 0.5 });
    expect(desc).toContain('c1');
    expect(desc).toContain('0.5');
  });

  it('describes setVolume', () => {
    const desc = describeChatCommand({ action: 'setVolume', clipId: 'c1', value: 0.8 });
    expect(desc).toContain('c1');
    expect(desc).toContain('0.8');
  });

  it('describes delete', () => {
    const desc = describeChatCommand({ action: 'delete', clipId: 'c1' });
    expect(desc).toContain('c1');
    expect(desc).toContain('删除');
  });

  it('describes split', () => {
    const desc = describeChatCommand({ action: 'split', clipId: 'c1', atTime: 5 });
    expect(desc).toContain('c1');
    expect(desc).toContain('5');
  });

  it('describes trim', () => {
    const desc = describeChatCommand({ action: 'trim', clipId: 'c1', trimStart: 1, trimEnd: 2 });
    expect(desc).toContain('c1');
  });

  it('describes deleteAllSilence', () => {
    const desc = describeChatCommand({ action: 'deleteAllSilence' });
    expect(desc).toContain('静音');
  });

  it('describes setAllClipsSpeed', () => {
    const desc = describeChatCommand({ action: 'setAllClipsSpeed', value: 1.5 });
    expect(desc).toContain('1.5');
  });

  it('describes applyColorPreset', () => {
    const desc = describeChatCommand({ action: 'applyColorPreset', presetName: '电影' });
    expect(desc).toContain('电影');
  });

  it('describes jumpTo', () => {
    const desc = describeChatCommand({ action: 'jumpTo', time: 30 });
    expect(desc).toContain('30');
  });

  it('describes selectClip', () => {
    const desc = describeChatCommand({ action: 'selectClip', clipId: 'c1' });
    expect(desc).toContain('c1');
  });

  it('returns the answer for query', () => {
    const desc = describeChatCommand({ action: 'query', answer: '当前有5个片段' });
    expect(desc).toBe('当前有5个片段');
  });
});

describe('ChatHistory', () => {
  it('starts empty', () => {
    const history = new ChatHistory();
    expect(history.length).toBe(0);
    expect(history.all).toEqual([]);
  });

  it('adds messages', () => {
    const history = new ChatHistory();
    history.add({ role: 'user', content: 'hello', timestamp: Date.now() });
    expect(history.length).toBe(1);
    expect(history.all[0].role).toBe('user');
  });

  it('enforces LRU 20-message limit', () => {
    const history = new ChatHistory();
    for (let i = 0; i < CHAT_HISTORY_MAX + 5; i++) {
      history.add({ role: i % 2 === 0 ? 'user' : 'assistant', content: `msg-${i}`, timestamp: Date.now() + i });
    }
    expect(history.length).toBe(CHAT_HISTORY_MAX);
    expect(history.all[0].content).toBe('msg-5');
  });

  it('clears all messages', () => {
    const history = new ChatHistory();
    history.add({ role: 'user', content: 'hello', timestamp: Date.now() });
    history.add({ role: 'assistant', content: 'hi', timestamp: Date.now() });
    history.clear();
    expect(history.length).toBe(0);
  });

  it('exports to API messages format', () => {
    const history = new ChatHistory();
    history.add({ role: 'user', content: 'hello', timestamp: 1000 });
    history.add({ role: 'assistant', content: 'hi', timestamp: 2000 });
    const apiMessages = history.toApiMessages();
    expect(apiMessages).toHaveLength(2);
    expect(apiMessages[0]).toEqual({ role: 'user', content: 'hello' });
    expect(apiMessages[1]).toEqual({ role: 'assistant', content: 'hi' });
    expect(apiMessages[0]).not.toHaveProperty('timestamp');
  });
});

describe('findClipInTimeline', () => {
  it('finds an existing clip', () => {
    const clip = makeVideoClip({ id: 'target', start: 0, duration: 5 });
    const timeline = makeTimeline([clip]);
    const found = findClipInTimeline(timeline, 'target');
    expect(found.id).toBe('target');
  });

  it('throws for non-existent clip', () => {
    const timeline = makeTimeline([]);
    expect(() => findClipInTimeline(timeline, 'missing')).toThrow('不存在');
  });
});

describe('getAllClipIds', () => {
  it('returns all clip IDs from all tracks', () => {
    const clip1 = makeVideoClip({ id: 'c1', trackId: 'track-video' });
    const clip2 = makeVideoClip({ id: 'c2', trackId: 'track-audio' });
    const timeline = makeTimeline([clip1, clip2]);
    const ids = getAllClipIds(timeline);
    expect(ids).toContain('c1');
    expect(ids).toContain('c2');
  });

  it('returns empty array for empty timeline', () => {
    const timeline = makeTimeline([]);
    expect(getAllClipIds(timeline)).toEqual([]);
  });
});

describe('query action', () => {
  it('returns answer without executing any command', () => {
    const result = parseChatAIResponse({ action: 'query', answer: '当前有3个片段' });
    expect(result.commands).toHaveLength(1);
    expect(result.commands[0].action).toBe('query');
    expect((result.commands[0] as any).answer).toBe('当前有3个片段');
  });
});
