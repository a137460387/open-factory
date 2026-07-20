/**
 * Sprint X Integration Test
 *
 * End-to-end pipeline test: Semantic Extraction → LLM Orchestration → Instruction Execution
 * Verifies the full "local feature extraction + cloud reasoning" workflow.
 */

import { describe, it, expect } from 'vitest';
import {
  aggregateMetadata,
  validateMetadataPrivacy,
  estimateMetadataUploadSize,
  calculateKeyFrameTimestamps,
  createDefaultExtractionConfig,
  generateAutoTags,
  buildTranscriptText,
} from './semantic-extractor';
import type { MaterialMetadata, KeyFrame, ASRSegment, AudioProfile, VisualProfile } from './semantic-extractor';
import {
  buildEditingPrompt,
  buildPlatformPrompt,
  parseEditPlan,
  parsePlatformContent,
  validateInstructionTarget,
  sortInstructionsByPriority,
  buildOpenAIRequestBody,
} from './llm-orchestrator';
import type { EditPlan, LLMMessage } from './llm-orchestrator';
import {
  PLATFORM_SPECS,
  validateUploadConfig,
  adaptMetadataForPlatform,
  calculateChunks,
} from '../distribution/platform-publisher';
import type { PlatformVideoMetadata } from '../distribution/platform-publisher';
import {
  createInitialPanelState,
  semanticPanelReducer,
  getMetadataStats,
  getProgressLabel,
} from './semantic-panel';
import {
  createInitialDialogueState,
  dialoguePanelReducer,
  turnsToLLMMessages,
  getExecutionSummary,
  getInstructionLabel,
} from './dialogue-panel';
import {
  createInitialPublishState,
  publishPanelReducer,
  getAuthenticatedPlatforms,
  getUploadProgressSummary,
} from './publish-panel';

// ─── Test Helpers ───────────────────────────────────────────────

function makeTestMetadata(): MaterialMetadata {
  return aggregateMetadata(
    {
      fileName: 'interview-2026.mp4',
      durationSec: 180,
      width: 1920,
      height: 1080,
      fps: 30,
      codec: 'h264',
      fileSizeBytes: 50_000_000,
    },
    [
      { timeSec: 0.5, frameIndex: 15, sceneLabel: 'intro', dominantColors: ['#1a1a2e'], brightness: 0.3 },
      { timeSec: 30, frameIndex: 900, sceneLabel: 'interview', hasFace: true, brightness: 0.6 },
      { timeSec: 90, frameIndex: 2700, sceneLabel: 'broll', brightness: 0.7 },
      { timeSec: 150, frameIndex: 4500, sceneLabel: 'outro', brightness: 0.4 },
    ],
    [
      { startSec: 0, endSec: 5, text: 'Welcome to our channel', confidence: 0.95, speakerId: 0 },
      { startSec: 6, endSec: 15, text: 'Today we are discussing AI video editing', confidence: 0.9, speakerId: 0 },
      { startSec: 16, endSec: 25, text: 'This technology allows automated editing workflows', confidence: 0.88, speakerId: 0 },
      { startSec: 30, endSec: 45, text: 'Let me show you how it works in practice', confidence: 0.92, speakerId: 1 },
      { startSec: 90, endSec: 100, text: 'The key advantage is privacy preservation', confidence: 0.85, speakerId: 0 },
      { startSec: 150, endSec: 160, text: 'Thanks for watching, subscribe for more', confidence: 0.93, speakerId: 0 },
    ],
    {
      avgLoudness: -14,
      peakDb: -1,
      silenceRatio: 0.15,
      hasMusic: false,
      speechRatio: 0.75,
      noiseLevel: 'quiet',
    },
    {
      motionIntensity: 0.4,
      colorPalette: ['#1a1a2e', '#16213e', '#e94560'],
      avgBrightness: 0.5,
      sceneDistribution: { interview: 0.5, broll: 0.3, intro: 0.1, outro: 0.1 },
      faceCount: 2,
      hasOverlay: false,
    },
    createDefaultExtractionConfig()
  ).metadata;
}

// ─── Full Pipeline Integration ──────────────────────────────────

describe('Sprint X Full Pipeline Integration', () => {
  it('completes extraction → privacy check → LLM prompt → parse plan → validate instructions', () => {
    // Step 1: Local semantic extraction produces metadata
    const metadata = makeTestMetadata();
    expect(metadata.version).toBe('1.0');
    expect(metadata.keyFrames.length).toBeGreaterThan(0);
    expect(metadata.asrSegments.length).toBeGreaterThan(0);
    expect(metadata.transcriptText.length).toBeGreaterThan(0);
    expect(metadata.tags.length).toBeGreaterThan(0);

    // Step 2: Privacy validation passes
    const privacy = validateMetadataPrivacy(metadata);
    expect(privacy.safe).toBe(true);
    expect(privacy.violations).toEqual([]);

    // Step 3: Upload size is reasonable (text only, no raw media)
    const uploadBytes = estimateMetadataUploadSize(metadata);
    expect(uploadBytes).toBeLessThan(100_000); // Under 100KB for metadata

    // Step 4: Build LLM editing prompt
    const messages = buildEditingPrompt([metadata], 'Create a 60-second highlight reel');
    expect(messages).toHaveLength(2);
    expect(messages[0].role).toBe('system');
    expect(messages[1].role).toBe('user');
    expect(messages[1].content).toContain('interview-2026.mp4');

    // Step 5: Build OpenAI request body
    const body = buildOpenAIRequestBody(messages, {
      provider: {
        id: 'openai', name: 'OpenAI', protocol: 'openai-compatible',
        baseUrl: 'https://api.openai.com', defaultModel: 'gpt-4', enabled: true, isBuiltIn: false,
      },
      responseFormat: 'json',
    });
    expect(body.model).toBe('gpt-4');
    expect(body.response_format).toEqual({ type: 'json_object' });

    // Step 6: Parse a simulated LLM response
    const simulatedResponse = JSON.stringify({
      title: 'AI Editing Highlight Reel',
      description: 'A 60-second highlight reel from the interview',
      instructions: [
        {
          id: 'inst-1',
          action: 'cut',
          target: { materialIndex: 0, startSec: 25, endSec: 30 },
          params: {},
          confidence: 0.9,
          reason: 'Remove transition gap between intro and interview',
        },
        {
          id: 'inst-2',
          action: 'add_subtitle',
          target: { materialIndex: 0, startSec: 0, endSec: 5 },
          params: { text: 'Welcome', style: 'modern' },
          confidence: 0.85,
          reason: 'Add opening subtitle',
        },
        {
          id: 'inst-3',
          action: 'add_transition',
          target: { materialIndex: 0, startSec: 30 },
          params: { type: 'crossfade', durationMs: 500 },
          confidence: 0.75,
          reason: 'Smooth transition to interview segment',
        },
      ],
      estimatedDurationSec: 60,
      creativeNotes: 'Use fast cuts for the broll section',
    });

    const planResult = parseEditPlan(simulatedResponse);
    expect(planResult.ok).toBe(true);
    if (planResult.ok) {
      expect(planResult.data.title).toBe('AI Editing Highlight Reel');
      expect(planResult.data.instructions).toHaveLength(3);

      // Step 7: Validate instruction targets
      for (const inst of planResult.data.instructions) {
        const valid = validateInstructionTarget(inst, 4, 180);
        expect(valid.valid).toBe(true);
      }

      // Step 8: Sort by priority
      const sorted = sortInstructionsByPriority(planResult.data.instructions);
      expect(sorted[0].action).toBe('cut');
      expect(sorted[1].action).toBe('add_transition');
      expect(sorted[2].action).toBe('add_subtitle');
    }
  });

  it('completes platform content generation pipeline', () => {
    const metadata = makeTestMetadata();

    // Build platform prompt
    const messages = buildPlatformPrompt(metadata, ['youtube', 'bilibili'], 'Focus on tech education');
    expect(messages[1].content).toContain('youtube');
    expect(messages[1].content).toContain('bilibili');
    expect(messages[1].content).toContain('tech education');

    // Parse simulated platform content response
    const simulatedResponse = JSON.stringify({
      platforms: [
        {
          platform: 'youtube',
          title: 'AI Video Editing: The Future of Content Creation',
          description: 'Learn how AI-powered video editing preserves privacy while automating workflows.',
          tags: ['ai', 'video-editing', 'automation', 'privacy'],
          hashtags: ['#AIEditing', '#VideoProduction'],
          category: 'Science & Technology',
          thumbnail: { timeSec: 30, reason: 'Speaker with engaging expression' },
        },
        {
          platform: 'bilibili',
          title: 'AI 视频编辑：自动化工作流实战',
          description: '探索 AI 如何在保护隐私的同时实现视频自动剪辑。',
          tags: ['AI', '视频编辑', '自动化'],
          category: '科技',
        },
      ],
    });

    const contentResult = parsePlatformContent(simulatedResponse);
    expect(contentResult.ok).toBe(true);
    if (contentResult.ok) {
      expect(contentResult.data).toHaveLength(2);
      expect(contentResult.data[0].platform).toBe('youtube');
      expect(contentResult.data[1].platform).toBe('bilibili');

      // Validate against platform specs
      const ytSpec = PLATFORM_SPECS.youtube;
      expect(contentResult.data[0].title.length).toBeLessThanOrEqual(ytSpec.maxTitleLength);
      expect(contentResult.data[0].tags.length).toBeLessThanOrEqual(ytSpec.maxTags);

      const biliSpec = PLATFORM_SPECS.bilibili;
      expect(contentResult.data[1].title.length).toBeLessThanOrEqual(biliSpec.maxTitleLength);
    }
  });

  it('adapts metadata for multiple platforms', () => {
    const baseMetadata: PlatformVideoMetadata = {
      title: 'A'.repeat(200), // Too long for all platforms
      description: 'B'.repeat(6000),
      tags: Array.from({ length: 20 }, (_, i) => `tag${i}`),
      visibility: 'public',
    };

    const platforms = ['youtube', 'bilibili', 'douyin', 'xiaohongshu'] as const;
    for (const platform of platforms) {
      const adapted = adaptMetadataForPlatform(baseMetadata, platform);
      const spec = PLATFORM_SPECS[platform];
      expect(adapted.title.length).toBeLessThanOrEqual(spec.maxTitleLength);
      expect(adapted.description.length).toBeLessThanOrEqual(spec.maxDescriptionLength);
      expect(adapted.tags.length).toBeLessThanOrEqual(spec.maxTags);
    }
  });
});

// ─── Panel State Integration ────────────────────────────────────

describe('Sprint X Panel State Integration', () => {
  it('semantic panel: full extraction workflow', () => {
    let state = createInitialPanelState();
    expect(state.phase).toBe('idle');

    // Configure
    state = semanticPanelReducer(state, { type: 'UPDATE_CONFIG', config: { maxKeyFrames: 10 } });
    expect(state.config.maxKeyFrames).toBe(10);

    // Start extraction
    state = semanticPanelReducer(state, { type: 'START_EXTRACTION' });
    expect(state.phase).toBe('extracting');
    expect(getProgressLabel(state)).toContain('Processing');

    // Progress updates
    state = semanticPanelReducer(state, { type: 'UPDATE_PROGRESS', event: { phase: 'keyframes', progress: 50 } });
    expect(getProgressLabel(state)).toContain('key frames');

    state = semanticPanelReducer(state, { type: 'UPDATE_PROGRESS', event: { phase: 'asr', progress: 80 } });

    // Complete
    const metadata = makeTestMetadata();
    state = semanticPanelReducer(state, { type: 'EXTRACTION_COMPLETE', metadata, warnings: [] });
    expect(state.phase).toBe('complete');
    expect(state.metadata).toBeDefined();

    // View stats
    const stats = getMetadataStats(metadata);
    expect(stats.keyFrameCount).toBe(4);
    expect(stats.segmentCount).toBeGreaterThan(0);
    expect(stats.duration).toBe('3:00');

    // Filter transcripts
    state = semanticPanelReducer(state, { type: 'SET_TRANSCRIPT_FILTER', query: 'privacy' });
    expect(state.transcriptFilter).toBe('privacy');
  });

  it('dialogue panel: full conversation workflow', () => {
    let state = createInitialDialogueState();

    // Load materials
    state = dialoguePanelReducer(state, { type: 'LOAD_MATERIALS', count: 3 });
    expect(state.hasMaterials).toBe(true);

    // User sends message
    state = dialoguePanelReducer(state, { type: 'SEND_MESSAGE', content: 'Create a highlight reel' });
    expect(state.phase).toBe('thinking');
    expect(state.turns).toHaveLength(1);

    // LLM responds with plan
    const plan: EditPlan = {
      title: 'Highlight Reel',
      description: '60-second highlight',
      instructions: [
        { id: 'i1', action: 'cut', target: { startSec: 25, endSec: 30 }, params: {}, confidence: 0.9, reason: 'trim gap' },
        { id: 'i2', action: 'add_subtitle', target: { startSec: 0, endSec: 5 }, params: { text: 'Hi' }, confidence: 0.8, reason: 'intro' },
      ],
      estimatedDurationSec: 60,
    };
    state = dialoguePanelReducer(state, { type: 'RECEIVE_RESPONSE', content: 'Here is the plan', plan });
    expect(state.phase).toBe('reviewing_plan');
    expect(state.activePlan).toBeDefined();

    // Modify instruction
    state = dialoguePanelReducer(state, { type: 'MODIFY_INSTRUCTION', instructionId: 'i1', updates: { confidence: 0.95 } });
    expect(state.activePlan!.instructions[0].confidence).toBe(0.95);

    // Approve and execute
    state = dialoguePanelReducer(state, { type: 'APPROVE_PLAN' });
    expect(state.planHistory).toHaveLength(1);

    state = dialoguePanelReducer(state, { type: 'EXECUTE_START' });
    expect(state.phase).toBe('executing');

    state = dialoguePanelReducer(state, {
      type: 'EXECUTE_COMPLETE',
      result: {
        planTitle: 'Highlight Reel',
        totalInstructions: 2,
        executed: 2,
        succeeded: 2,
        failed: 0,
        skipped: 0,
        results: [
          { instructionId: 'i1', success: true, executionMs: 50 },
          { instructionId: 'i2', success: true, executionMs: 30 },
        ],
        totalMs: 80,
      },
    });
    expect(state.phase).toBe('complete');
    expect(state.executionResults!.succeeded).toBe(2);

    // Verify conversation history
    const messages = turnsToLLMMessages(state.turns);
    expect(messages.length).toBeGreaterThan(0);

    const summary = getExecutionSummary(state.executionResults!);
    expect(summary).toContain('2/2');
  });

  it('publish panel: full publishing workflow', () => {
    let state = createInitialPublishState();

    // Set video
    state = publishPanelReducer(state, { type: 'SET_VIDEO_PATH', path: '/renders/final.mp4' });
    expect(state.videoPath).toBe('/renders/final.mp4');

    // Select platforms
    state = publishPanelReducer(state, { type: 'TOGGLE_PLATFORM', platform: 'youtube' });
    state = publishPanelReducer(state, { type: 'TOGGLE_PLATFORM', platform: 'bilibili' });
    expect(state.selectedPlatforms).toHaveLength(2);

    // Update metadata
    state = publishPanelReducer(state, {
      type: 'UPDATE_BASE_METADATA',
      updates: { title: 'My AI Video', description: 'Made with AI', tags: ['ai'] },
    });

    // Set auth tokens
    state = publishPanelReducer(state, {
      type: 'SET_AUTH_TOKEN',
      token: { platform: 'youtube', accessToken: 'yt-token', expiresAt: Date.now() + 3600_000, scopes: [] },
    });
    state = publishPanelReducer(state, {
      type: 'SET_AUTH_TOKEN',
      token: { platform: 'bilibili', accessToken: 'bili-token', expiresAt: Date.now() + 3600_000, scopes: [] },
    });

    // Check authenticated platforms
    const authed = getAuthenticatedPlatforms(state);
    expect(authed).toHaveLength(2);

    // Upload
    state = publishPanelReducer(state, { type: 'START_UPLOAD' });
    expect(state.phase).toBe('uploading');

    state = publishPanelReducer(state, {
      type: 'UPDATE_PROGRESS',
      platform: 'youtube',
      event: { uploadedBytes: 50, totalBytes: 100, percent: 50, phase: 'uploading' },
    });

    state = publishPanelReducer(state, {
      type: 'UPLOAD_COMPLETE',
      platform: 'youtube',
      result: { platform: 'youtube', success: true, videoId: 'vid-123', videoUrl: 'https://youtube.com/watch?v=vid-123', durationMs: 5000 },
    });

    state = publishPanelReducer(state, {
      type: 'UPLOAD_COMPLETE',
      platform: 'bilibili',
      result: { platform: 'bilibili', success: true, videoId: 'bv-456', durationMs: 3000 },
    });

    state = publishPanelReducer(state, { type: 'ALL_UPLOADS_COMPLETE' });
    expect(state.phase).toBe('complete');

    const progress = getUploadProgressSummary(state);
    expect(progress.completed).toBe(2);
    expect(progress.total).toBe(2);
    expect(progress.overallPercent).toBe(100);
  });
});

// ─── Privacy Enforcement ────────────────────────────────────────

describe('Sprint X Privacy Enforcement', () => {
  it('metadata contains no raw media references', () => {
    const metadata = makeTestMetadata();
    const json = JSON.stringify(metadata);

    // No base64 video/audio data
    expect(json).not.toMatch(/data:video/);
    expect(json).not.toMatch(/data:audio/);

    // No file system paths to raw media
    expect(json).not.toMatch(/\/raw\//);
    expect(json).not.toMatch(/\.mov/);
  });

  it('key frame previews are within size limits', () => {
    const metadata = makeTestMetadata();
    const privacy = validateMetadataPrivacy(metadata);
    expect(privacy.safe).toBe(true);

    for (const kf of metadata.keyFrames) {
      if (kf.previewWidth) expect(kf.previewWidth).toBeLessThanOrEqual(640);
      if (kf.previewHeight) expect(kf.previewHeight).toBeLessThanOrEqual(360);
    }
  });

  it('upload size is bounded', () => {
    const metadata = makeTestMetadata();
    const sizeBytes = estimateMetadataUploadSize(metadata);
    // Even with all metadata, should be well under 1MB
    expect(sizeBytes).toBeLessThan(1_000_000);
  });
});

// ─── Cross-module Data Flow ─────────────────────────────────────

describe('Sprint X Cross-module Data Flow', () => {
  it('semantic extractor output flows into LLM orchestrator input', () => {
    const metadata = makeTestMetadata();

    // Extractor output is valid MaterialMetadata
    expect(metadata.version).toBe('1.0');
    expect(metadata.source.fileName).toBeTruthy();

    // Can be directly used as LLM orchestrator input
    const messages = buildEditingPrompt([metadata], 'test');
    expect(messages[1].content).toContain(metadata.source.fileName);
    expect(messages[1].content).toContain(metadata.transcriptText.substring(0, 50));
  });

  it('LLM orchestrator output flows into platform publisher', () => {
    const simulatedResponse = JSON.stringify({
      platforms: [{
        platform: 'youtube',
        title: 'Test Title',
        description: 'Test Description',
        tags: ['test'],
      }],
    });

    const parsed = parsePlatformContent(simulatedResponse);
    expect(parsed.ok).toBe(true);

    if (parsed.ok) {
      const content = parsed.data[0];
      // Platform content can be used to validate against platform specs
      const config = {
        videoPath: '/test.mp4',
        metadata: { title: content.title, description: content.description, tags: content.tags, visibility: 'public' as const },
      };
      const errors = validateUploadConfig(config, 'youtube');
      expect(errors).toEqual([]);
    }
  });

  it('key frame timestamps are valid for all video durations', () => {
    const durations = [0.5, 1, 10, 60, 300, 3600];
    for (const d of durations) {
      const timestamps = calculateKeyFrameTimestamps(d, { maxKeyFrames: 20, intervalSec: 0 });
      expect(timestamps.length).toBeGreaterThan(0);
      expect(timestamps.length).toBeLessThanOrEqual(20);
      // All within bounds
      for (const t of timestamps) {
        expect(t).toBeGreaterThanOrEqual(0);
        expect(t).toBeLessThanOrEqual(d);
      }
      // Sorted
      for (let i = 1; i < timestamps.length; i++) {
        expect(timestamps[i]).toBeGreaterThan(timestamps[i - 1]);
      }
    }
  });

  it('chunked upload calculation works for all file sizes', () => {
    const sizes = [0, 1, 1024, 1024 * 1024, 100 * 1024 * 1024];
    const chunkSize = 10 * 1024 * 1024; // 10MB

    for (const size of sizes) {
      const chunks = calculateChunks(size, chunkSize);
      if (size === 0) {
        expect(chunks).toEqual([]);
      } else {
        // Total bytes covered
        const totalCovered = chunks.reduce((acc, c) => acc + (c.end - c.start + 1), 0);
        expect(totalCovered).toBe(size);
        // No gaps
        for (let i = 1; i < chunks.length; i++) {
          expect(chunks[i].start).toBe(chunks[i - 1].end + 1);
        }
      }
    }
  });
});
