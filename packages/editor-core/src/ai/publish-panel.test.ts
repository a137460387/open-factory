import { describe, it, expect } from 'vitest';
import {
  createInitialPublishState,
  publishPanelReducer,
  getAuthenticatedPlatforms,
  getUnauthenticatedPlatforms,
  buildPublishRequest,
  getEffectiveMetadata,
  getUploadProgressSummary,
  getPlatformDisplay,
} from './publish-panel';
import type { PlatformAuthToken, PlatformId } from '../distribution/platform-publisher';

function makeToken(platform: 'youtube' | 'bilibili' = 'youtube', expired = false): PlatformAuthToken {
  return {
    platform,
    accessToken: 'test-token',
    expiresAt: expired ? Date.now() - 1000 : Date.now() + 3600_000,
    scopes: ['upload'],
  };
}

// ─── publishPanelReducer ───────────────────────────────────────

describe('publishPanelReducer', () => {
  it('sets video path', () => {
    const state = createInitialPublishState();
    const next = publishPanelReducer(state, { type: 'SET_VIDEO_PATH', path: '/test.mp4' });
    expect(next.videoPath).toBe('/test.mp4');
  });

  it('toggles platform selection', () => {
    const state = createInitialPublishState();
    const next = publishPanelReducer(state, { type: 'TOGGLE_PLATFORM', platform: 'youtube' });
    expect(next.selectedPlatforms).toContain('youtube');
    const next2 = publishPanelReducer(next, { type: 'TOGGLE_PLATFORM', platform: 'youtube' });
    expect(next2.selectedPlatforms).not.toContain('youtube');
  });

  it('selects all platforms', () => {
    const state = createInitialPublishState();
    const next = publishPanelReducer(state, { type: 'SELECT_ALL_PLATFORMS' });
    expect(next.selectedPlatforms).toHaveLength(4);
  });

  it('deselects all platforms', () => {
    const state = { ...createInitialPublishState(), selectedPlatforms: ['youtube', 'bilibili'] as PlatformId[] };
    const next = publishPanelReducer(state, { type: 'DESELECT_ALL_PLATFORMS' });
    expect(next.selectedPlatforms).toEqual([]);
  });

  it('updates base metadata', () => {
    const state = createInitialPublishState();
    const next = publishPanelReducer(state, {
      type: 'UPDATE_BASE_METADATA',
      updates: { title: 'My Video', tags: ['test'] },
    });
    expect(next.baseMetadata.title).toBe('My Video');
    expect(next.baseMetadata.tags).toEqual(['test']);
  });

  it('sets mode', () => {
    const state = createInitialPublishState();
    const next = publishPanelReducer(state, {
      type: 'SET_MODE',
      mode: 'scheduled',
      scheduledAt: '2026-07-21T10:00:00Z',
    });
    expect(next.mode).toBe('scheduled');
    expect(next.scheduledAt).toBe('2026-07-21T10:00:00Z');
  });

  it('sets auth token', () => {
    const state = createInitialPublishState();
    const token = makeToken('youtube');
    const next = publishPanelReducer(state, { type: 'SET_AUTH_TOKEN', token });
    expect(next.authTokens.get('youtube')).toBe(token);
  });

  it('removes auth token', () => {
    const state = createInitialPublishState();
    state.authTokens.set('youtube', makeToken('youtube'));
    const next = publishPanelReducer(state, { type: 'REMOVE_AUTH_TOKEN', platform: 'youtube' });
    expect(next.authTokens.has('youtube')).toBe(false);
  });

  it('sets AI content', () => {
    const state = createInitialPublishState();
    const content = {
      platform: 'youtube',
      title: 'AI Title',
      description: 'AI Desc',
      tags: ['ai'],
    };
    const next = publishPanelReducer(state, { type: 'SET_AI_CONTENT', platform: 'youtube', content });
    expect(next.platformStates.get('youtube')?.aiContent).toEqual(content);
  });

  it('toggles use AI content', () => {
    const state = createInitialPublishState();
    // Need to set AI content first to have platform state
    const withContent = publishPanelReducer(state, {
      type: 'SET_AI_CONTENT',
      platform: 'youtube',
      content: { platform: 'youtube', title: '', description: '', tags: [] },
    });
    expect(withContent.platformStates.get('youtube')?.useAIContent).toBe(true);
    const toggled = publishPanelReducer(withContent, { type: 'TOGGLE_USE_AI_CONTENT', platform: 'youtube' });
    expect(toggled.platformStates.get('youtube')?.useAIContent).toBe(false);
  });

  it('starts upload', () => {
    const state = createInitialPublishState();
    const next = publishPanelReducer(state, { type: 'START_UPLOAD' });
    expect(next.phase).toBe('uploading');
  });

  it('updates progress', () => {
    const state = createInitialPublishState();
    const next = publishPanelReducer(state, {
      type: 'UPDATE_PROGRESS',
      platform: 'youtube',
      event: { uploadedBytes: 50, totalBytes: 100, percent: 50, phase: 'uploading' },
    });
    expect(next.platformStates.get('youtube')?.progress?.percent).toBe(50);
  });

  it('completes upload', () => {
    const state = createInitialPublishState();
    const result = { platform: 'youtube' as const, success: true, videoId: 'vid1', durationMs: 5000 };
    const next = publishPanelReducer(state, { type: 'UPLOAD_COMPLETE', platform: 'youtube', result });
    expect(next.platformStates.get('youtube')?.result?.success).toBe(true);
  });

  it('resets state', () => {
    const state = { ...createInitialPublishState(), phase: 'uploading' as const };
    const next = publishPanelReducer(state, { type: 'RESET' });
    expect(next.phase).toBe('idle');
  });
});

// ─── Selectors ──────────────────────────────────────────────────

describe('getAuthenticatedPlatforms', () => {
  it('returns platforms with valid tokens', () => {
    const state = createInitialPublishState();
    state.selectedPlatforms = ['youtube', 'bilibili'] as PlatformId[];
    state.authTokens.set('youtube', makeToken('youtube'));
    expect(getAuthenticatedPlatforms(state)).toEqual(['youtube']);
  });

  it('excludes expired tokens', () => {
    const state = createInitialPublishState();
    state.selectedPlatforms = ['youtube'] as PlatformId[];
    state.authTokens.set('youtube', makeToken('youtube', true));
    expect(getAuthenticatedPlatforms(state)).toEqual([]);
  });
});

describe('getUnauthenticatedPlatforms', () => {
  it('returns platforms without tokens', () => {
    const state = createInitialPublishState();
    state.selectedPlatforms = ['youtube', 'bilibili'] as PlatformId[];
    state.authTokens.set('youtube', makeToken('youtube'));
    expect(getUnauthenticatedPlatforms(state)).toEqual(['bilibili']);
  });
});

describe('buildPublishRequest', () => {
  it('builds request', () => {
    const state = createInitialPublishState();
    state.videoPath = '/test.mp4';
    state.selectedPlatforms = ['youtube'] as PlatformId[];
    state.baseMetadata = { title: 'Test', description: '', tags: [], visibility: 'public' };
    const req = buildPublishRequest(state);
    expect(req).not.toBeNull();
    expect(req!.platforms).toEqual(['youtube']);
    expect(req!.videoPath).toBe('/test.mp4');
  });

  it('returns null when missing video path', () => {
    const state = createInitialPublishState();
    state.selectedPlatforms = ['youtube'] as PlatformId[];
    expect(buildPublishRequest(state)).toBeNull();
  });

  it('returns null when no platforms', () => {
    const state = createInitialPublishState();
    state.videoPath = '/test.mp4';
    expect(buildPublishRequest(state)).toBeNull();
  });
});

describe('getEffectiveMetadata', () => {
  it('returns base metadata when no AI content', () => {
    const state = createInitialPublishState();
    state.baseMetadata = { title: 'Base', description: '', tags: [], visibility: 'public' };
    expect(getEffectiveMetadata(state, 'youtube').title).toBe('Base');
  });

  it('returns AI content when enabled', () => {
    const state = createInitialPublishState();
    state.baseMetadata = { title: 'Base', description: '', tags: [], visibility: 'public' };
    const nextState = publishPanelReducer(state, {
      type: 'SET_AI_CONTENT',
      platform: 'youtube',
      content: { platform: 'youtube', title: 'AI Title', description: 'AI Desc', tags: ['ai'] },
    });
    expect(getEffectiveMetadata(nextState, 'youtube').title).toBe('AI Title');
  });
});

describe('getUploadProgressSummary', () => {
  it('returns zeros for empty state', () => {
    const summary = getUploadProgressSummary(createInitialPublishState());
    expect(summary.total).toBe(0);
    expect(summary.completed).toBe(0);
    expect(summary.overallPercent).toBe(0);
  });

  it('counts completed uploads', () => {
    const state = createInitialPublishState();
    state.selectedPlatforms = ['youtube', 'bilibili'] as PlatformId[];
    const s1 = publishPanelReducer(state, {
      type: 'UPLOAD_COMPLETE',
      platform: 'youtube',
      result: { platform: 'youtube', success: true, videoId: 'v1', durationMs: 1000 },
    });
    const summary = getUploadProgressSummary(s1);
    expect(summary.completed).toBe(1);
    expect(summary.total).toBe(2);
  });
});

describe('getPlatformDisplay', () => {
  it('returns display info for youtube', () => {
    const display = getPlatformDisplay('youtube');
    expect(display.name).toBe('YouTube');
    expect(display.maxTitle).toBeGreaterThan(0);
  });
});
