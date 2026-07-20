import { describe, it, expect } from 'vitest';
import {
  buildEditingPrompt,
  buildPlatformPrompt,
  buildConversationalPrompt,
  parseEditPlan,
  parsePlatformContent,
  validateInstructionTarget,
  sortInstructionsByPriority,
  buildLLMHeaders,
  buildOpenAIRequestBody,
} from './llm-orchestrator';
import type {
  EditInstruction,
  EditActionType,
  LLMMessage,
} from './llm-orchestrator';
import type { MaterialMetadata } from './semantic-extractor';
import type { AIProvider } from '../ai-service';
import type { AudioProfile, VisualProfile } from './semantic-extractor';

// ─── Test Helpers ───────────────────────────────────────────────

function makeProvider(overrides: Partial<AIProvider> = {}): AIProvider {
  return {
    id: 'test',
    name: 'Test Provider',
    protocol: 'openai-compatible',
    baseUrl: 'https://api.test.com',
    apiKey: 'test-key',
    defaultModel: 'gpt-4',
    enabled: true,
    isBuiltIn: false,
    ...overrides,
  };
}

function makeAudio(): AudioProfile {
  return {
    avgLoudness: -14, peakDb: -1, silenceRatio: 0.1,
    hasMusic: false, speechRatio: 0.8, noiseLevel: 'quiet',
  };
}

function makeVisual(): VisualProfile {
  return {
    motionIntensity: 0.5, colorPalette: ['#ff0000'],
    avgBrightness: 0.5, sceneDistribution: { indoor: 0.6 },
    faceCount: 1, hasOverlay: false,
  };
}

function makeMetadata(overrides: Partial<MaterialMetadata> = {}): MaterialMetadata {
  return {
    version: '1.0',
    source: {
      fileName: 'test.mp4', durationSec: 60, width: 1920,
      height: 1080, fps: 30, codec: 'h264', fileSizeBytes: 10_000_000,
    },
    extractedAt: new Date().toISOString(),
    keyFrames: [],
    asrSegments: [],
    transcriptText: 'Hello world this is a test video',
    audioProfile: makeAudio(),
    visualProfile: makeVisual(),
    tags: ['speech', 'indoor'],
    ...overrides,
  };
}

function makeInstruction(overrides: Partial<EditInstruction> = {}): EditInstruction {
  return {
    id: 'inst-1',
    action: 'cut',
    target: { materialIndex: 0, startSec: 5, endSec: 10 },
    params: {},
    confidence: 0.8,
    reason: 'Remove dead air',
    ...overrides,
  };
}

// ─── buildEditingPrompt ────────────────────────────────────────

describe('buildEditingPrompt', () => {
  it('returns system + user messages', () => {
    const messages = buildEditingPrompt([makeMetadata()], 'Make a highlight reel');
    expect(messages).toHaveLength(2);
    expect(messages[0].role).toBe('system');
    expect(messages[1].role).toBe('user');
  });

  it('includes material info in user message', () => {
    const messages = buildEditingPrompt([makeMetadata()], 'Edit this');
    const userContent = messages[1].content;
    expect(userContent).toContain('test.mp4');
    expect(userContent).toContain('60');
    expect(userContent).toContain('speech');
  });

  it('includes user request', () => {
    const messages = buildEditingPrompt([makeMetadata()], 'Make it cinematic');
    expect(messages[1].content).toContain('Make it cinematic');
  });

  it('handles multiple materials', () => {
    const messages = buildEditingPrompt(
      [makeMetadata(), makeMetadata({ source: { ...makeMetadata().source, fileName: 'b.mp4' } })],
      'Combine these'
    );
    expect(messages[1].content).toContain('test.mp4');
    expect(messages[1].content).toContain('b.mp4');
  });

  it('truncates long transcripts', () => {
    const longTranscript = 'word '.repeat(1000);
    const messages = buildEditingPrompt([makeMetadata({ transcriptText: longTranscript })], 'Edit');
    // Should be truncated, not full 5000 words
    expect(messages[1].content.length).toBeLessThan(longTranscript.length);
  });
});

// ─── buildPlatformPrompt ───────────────────────────────────────

describe('buildPlatformPrompt', () => {
  it('includes platform list', () => {
    const messages = buildPlatformPrompt(makeMetadata(), ['youtube', 'bilibili']);
    expect(messages[1].content).toContain('youtube');
    expect(messages[1].content).toContain('bilibili');
  });

  it('includes user hints when provided', () => {
    const messages = buildPlatformPrompt(makeMetadata(), ['youtube'], 'Focus on gaming');
    expect(messages[1].content).toContain('Focus on gaming');
  });

  it('omits hints section when not provided', () => {
    const messages = buildPlatformPrompt(makeMetadata(), ['youtube']);
    expect(messages[1].content).not.toContain('Additional Hints');
  });
});

// ─── buildConversationalPrompt ─────────────────────────────────

describe('buildConversationalPrompt', () => {
  it('includes system, context, history, and new message', () => {
    const history: LLMMessage[] = [
      { role: 'user', content: 'First message' },
      { role: 'assistant', content: 'First response' },
    ];
    const messages = buildConversationalPrompt(
      [makeMetadata()],
      history,
      'Now do this'
    );
    expect(messages[0].role).toBe('system');
    // Context + history + new message
    expect(messages.length).toBeGreaterThanOrEqual(4);
    expect(messages[messages.length - 1].content).toBe('Now do this');
  });
});

// ─── parseEditPlan ─────────────────────────────────────────────

describe('parseEditPlan', () => {
  const validPlan = JSON.stringify({
    title: 'Quick Edit',
    description: 'Remove dead air',
    instructions: [
      {
        id: 'inst-1',
        action: 'cut',
        target: { materialIndex: 0, startSec: 5, endSec: 10 },
        params: {},
        confidence: 0.9,
        reason: 'Dead air removal',
      },
    ],
    estimatedDurationSec: 50,
  });

  it('parses valid plan', () => {
    const result = parseEditPlan(validPlan);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.title).toBe('Quick Edit');
      expect(result.data.instructions).toHaveLength(1);
    }
  });

  it('rejects invalid JSON', () => {
    const result = parseEditPlan('not json');
    expect(result.ok).toBe(false);
  });

  it('rejects non-object', () => {
    const result = parseEditPlan('"string"');
    expect(result.ok).toBe(false);
  });

  it('rejects missing title', () => {
    const result = parseEditPlan(JSON.stringify({
      description: 'test',
      instructions: [],
      estimatedDurationSec: 10,
    }));
    expect(result.ok).toBe(false);
  });

  it('rejects invalid action type', () => {
    const result = parseEditPlan(JSON.stringify({
      title: 'Test',
      description: 'test',
      instructions: [{
        id: '1',
        action: 'invalid_action',
        target: {},
        params: {},
        confidence: 0.5,
        reason: 'test',
      }],
      estimatedDurationSec: 10,
    }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some(e => e.message.includes('Invalid action'))).toBe(true);
    }
  });

  it('rejects confidence out of range', () => {
    const result = parseEditPlan(JSON.stringify({
      title: 'Test',
      description: 'test',
      instructions: [{
        id: '1',
        action: 'cut',
        target: {},
        params: {},
        confidence: 1.5,
        reason: 'test',
      }],
      estimatedDurationSec: 10,
    }));
    expect(result.ok).toBe(false);
  });

  it('accepts plan with optional creativeNotes', () => {
    const plan = JSON.parse(validPlan);
    plan.creativeNotes = 'Try a montage style';
    const result = parseEditPlan(JSON.stringify(plan));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.creativeNotes).toBe('Try a montage style');
    }
  });
});

// ─── parsePlatformContent ──────────────────────────────────────

describe('parsePlatformContent', () => {
  const validContent = JSON.stringify({
    platforms: [
      {
        platform: 'youtube',
        title: 'My Video',
        description: 'A great video',
        tags: ['test', 'video'],
        hashtags: ['#test'],
        thumbnail: { timeSec: 5, reason: 'Best frame' },
      },
    ],
  });

  it('parses valid content', () => {
    const result = parsePlatformContent(validContent);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveLength(1);
      expect(result.data[0].platform).toBe('youtube');
    }
  });

  it('rejects missing platforms array', () => {
    const result = parsePlatformContent(JSON.stringify({ title: 'test' }));
    expect(result.ok).toBe(false);
  });

  it('rejects missing required fields', () => {
    const result = parsePlatformContent(JSON.stringify({
      platforms: [{ platform: 'youtube' }],
    }));
    expect(result.ok).toBe(false);
  });

  it('rejects invalid JSON', () => {
    expect(parsePlatformContent('{bad').ok).toBe(false);
  });
});

// ─── validateInstructionTarget ─────────────────────────────────

describe('validateInstructionTarget', () => {
  it('passes for valid target', () => {
    const inst = makeInstruction({ target: { materialIndex: 0, startSec: 5, endSec: 10 } });
    expect(validateInstructionTarget(inst, 3, 60).valid).toBe(true);
  });

  it('rejects out-of-range materialIndex', () => {
    const inst = makeInstruction({ target: { materialIndex: 5 } });
    expect(validateInstructionTarget(inst, 3, 60).valid).toBe(false);
  });

  it('rejects negative materialIndex', () => {
    const inst = makeInstruction({ target: { materialIndex: -1 } });
    expect(validateInstructionTarget(inst, 3, 60).valid).toBe(false);
  });

  it('rejects negative startSec', () => {
    const inst = makeInstruction({ target: { startSec: -1 } });
    expect(validateInstructionTarget(inst, 3, 60).valid).toBe(false);
  });

  it('rejects endSec exceeding max duration', () => {
    const inst = makeInstruction({ target: { endSec: 100 } });
    expect(validateInstructionTarget(inst, 3, 60).valid).toBe(false);
  });

  it('rejects startSec >= endSec', () => {
    const inst = makeInstruction({ target: { startSec: 10, endSec: 5 } });
    expect(validateInstructionTarget(inst, 3, 60).valid).toBe(false);
  });

  it('passes when target fields are omitted', () => {
    const inst = makeInstruction({ target: {} });
    expect(validateInstructionTarget(inst, 3, 60).valid).toBe(true);
  });
});

// ─── sortInstructionsByPriority ────────────────────────────────

describe('sortInstructionsByPriority', () => {
  it('sorts split before cut before add_subtitle', () => {
    const instructions = [
      makeInstruction({ id: '3', action: 'add_subtitle' }),
      makeInstruction({ id: '1', action: 'split' }),
      makeInstruction({ id: '2', action: 'cut' }),
    ];
    const sorted = sortInstructionsByPriority(instructions);
    expect(sorted[0].action).toBe('split');
    expect(sorted[1].action).toBe('cut');
    expect(sorted[2].action).toBe('add_subtitle');
  });

  it('does not mutate input', () => {
    const instructions = [
      makeInstruction({ action: 'add_subtitle' }),
      makeInstruction({ action: 'cut' }),
    ];
    const original = [...instructions];
    sortInstructionsByPriority(instructions);
    expect(instructions).toEqual(original);
  });

  it('handles single instruction', () => {
    const inst = [makeInstruction()];
    expect(sortInstructionsByPriority(inst)).toHaveLength(1);
  });

  it('handles empty array', () => {
    expect(sortInstructionsByPriority([])).toEqual([]);
  });
});

// ─── buildLLMHeaders ───────────────────────────────────────────

describe('buildLLMHeaders', () => {
  it('includes auth header when apiKey present', () => {
    const headers = buildLLMHeaders(makeProvider({ apiKey: 'sk-123' }));
    expect(headers['Authorization']).toBe('Bearer sk-123');
  });

  it('omits auth header when no apiKey', () => {
    const headers = buildLLMHeaders(makeProvider({ apiKey: undefined }));
    expect(headers['Authorization']).toBeUndefined();
  });

  it('includes custom headers', () => {
    const headers = buildLLMHeaders(makeProvider({ customHeaders: { 'X-Custom': 'val' } }));
    expect(headers['X-Custom']).toBe('val');
  });

  it('always includes content-type', () => {
    const headers = buildLLMHeaders(makeProvider());
    expect(headers['Content-Type']).toBe('application/json');
  });
});

// ─── buildOpenAIRequestBody ────────────────────────────────────

describe('buildOpenAIRequestBody', () => {
  it('builds correct body structure', () => {
    const messages: LLMMessage[] = [
      { role: 'system', content: 'You are helpful' },
      { role: 'user', content: 'Hello' },
    ];
    const body = buildOpenAIRequestBody(messages, {
      provider: makeProvider(),
      temperature: 0.5,
    });

    expect(body.model).toBe('gpt-4');
    expect(body.messages).toHaveLength(2);
    expect(body.temperature).toBe(0.5);
    expect(body.max_tokens).toBe(4096);
  });

  it('uses model override', () => {
    const body = buildOpenAIRequestBody(
      [{ role: 'user', content: 'test' }],
      { provider: makeProvider(), model: 'claude-3' }
    );
    expect(body.model).toBe('claude-3');
  });

  it('adds json response format when requested', () => {
    const body = buildOpenAIRequestBody(
      [{ role: 'user', content: 'test' }],
      { provider: makeProvider(), responseFormat: 'json' }
    );
    expect(body.response_format).toEqual({ type: 'json_object' });
  });

  it('omits response format when not json', () => {
    const body = buildOpenAIRequestBody(
      [{ role: 'user', content: 'test' }],
      { provider: makeProvider(), responseFormat: 'text' }
    );
    expect(body.response_format).toBeUndefined();
  });

  it('includes image attachments', () => {
    const messages: LLMMessage[] = [{
      role: 'user',
      content: 'Analyze this',
      images: [{ base64: 'abc123', mimeType: 'image/jpeg' }],
    }];
    const body = buildOpenAIRequestBody(messages, { provider: makeProvider() });
    const msg = body.messages as Array<{ content: unknown }>;
    const content = msg[0].content as Array<{ type: string }>;
    expect(content).toHaveLength(2);
    expect(content[0].type).toBe('text');
    expect(content[1].type).toBe('image_url');
  });
});

// ─── All EditActionType values ─────────────────────────────────

describe('EditActionType completeness', () => {
  const allActions: EditActionType[] = [
    'cut', 'trim', 'reorder', 'add_transition', 'add_subtitle',
    'adjust_audio', 'add_effect', 'split', 'merge', 'speed', 'fade', 'narration',
  ];

  it('parseEditPlan accepts all action types', () => {
    for (const action of allActions) {
      const json = JSON.stringify({
        title: 'Test',
        description: 'Test',
        instructions: [{
          id: '1', action, target: {}, params: {}, confidence: 0.8, reason: 'test',
        }],
        estimatedDurationSec: 10,
      });
      const result = parseEditPlan(json);
      expect(result.ok).toBe(true);
    }
  });

  it('sortInstructionsByPriority handles all action types', () => {
    const instructions = allActions.map((action, i) =>
      makeInstruction({ id: `${i}`, action })
    );
    const sorted = sortInstructionsByPriority(instructions);
    expect(sorted).toHaveLength(allActions.length);
  });
});
