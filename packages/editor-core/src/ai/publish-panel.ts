/**
 * Multi-Platform Publish Panel
 *
 * Data layer for the multi-platform publishing UI panel.
 * Manages platform selection, metadata adaptation, upload progress,
 * and AI-generated platform content.
 */

import type {
  PlatformId,
  PlatformVideoMetadata,
  UploadProgressEvent,
  UploadResult,
  PlatformAuthToken,
  MultiPlatformPublishRequest,
} from '../distribution/platform-publisher';
import { PLATFORM_SPECS } from '../distribution/platform-publisher';
import type { PlatformContent } from '../ai/llm-orchestrator';

// ─── Panel State ────────────────────────────────────────────────

export type PublishPanelPhase =
  | 'idle'
  | 'configuring'
  | 'generating_content'
  | 'uploading'
  | 'complete'
  | 'error';

export interface PlatformUploadState {
  platform: PlatformId;
  progress?: UploadProgressEvent;
  result?: UploadResult;
  /** AI-generated content for this platform */
  aiContent?: PlatformContent;
  /** Whether to use AI-generated content */
  useAIContent: boolean;
}

export interface PublishPanelState {
  /** Current phase */
  phase: PublishPanelPhase;
  /** Selected platforms */
  selectedPlatforms: PlatformId[];
  /** Base metadata (before platform adaptation) */
  baseMetadata: PlatformVideoMetadata;
  /** Per-platform upload state */
  platformStates: Map<PlatformId, PlatformUploadState>;
  /** Auth tokens */
  authTokens: Map<PlatformId, PlatformAuthToken>;
  /** Publish mode */
  mode: 'immediate' | 'scheduled';
  /** Scheduled time */
  scheduledAt?: string;
  /** Overall error */
  error?: string;
  /** Video file path */
  videoPath: string;
  /** Thumbnail path */
  thumbnailPath?: string;
}

export function createInitialPublishState(): PublishPanelState {
  return {
    phase: 'idle',
    selectedPlatforms: [],
    baseMetadata: {
      title: '',
      description: '',
      tags: [],
      visibility: 'public',
    },
    platformStates: new Map(),
    authTokens: new Map(),
    mode: 'immediate',
    videoPath: '',
  };
}

// ─── Panel Actions ──────────────────────────────────────────────

export type PublishPanelAction =
  | { type: 'SET_VIDEO_PATH'; path: string }
  | { type: 'SET_THUMBNAIL_PATH'; path: string }
  | { type: 'TOGGLE_PLATFORM'; platform: PlatformId }
  | { type: 'SELECT_ALL_PLATFORMS' }
  | { type: 'DESELECT_ALL_PLATFORMS' }
  | { type: 'UPDATE_BASE_METADATA'; updates: Partial<PlatformVideoMetadata> }
  | { type: 'SET_MODE'; mode: 'immediate' | 'scheduled'; scheduledAt?: string }
  | { type: 'SET_AUTH_TOKEN'; token: PlatformAuthToken }
  | { type: 'REMOVE_AUTH_TOKEN'; platform: PlatformId }
  | { type: 'SET_AI_CONTENT'; platform: PlatformId; content: PlatformContent }
  | { type: 'TOGGLE_USE_AI_CONTENT'; platform: PlatformId }
  | { type: 'START_GENERATING_CONTENT' }
  | { type: 'CONTENT_GENERATED' }
  | { type: 'START_UPLOAD' }
  | { type: 'UPDATE_PROGRESS'; platform: PlatformId; event: UploadProgressEvent }
  | { type: 'UPLOAD_COMPLETE'; platform: PlatformId; result: UploadResult }
  | { type: 'ALL_UPLOADS_COMPLETE' }
  | { type: 'SET_ERROR'; error: string }
  | { type: 'CLEAR_ERROR' }
  | { type: 'RESET' };

/**
 * Pure state reducer for the publish panel.
 */
export function publishPanelReducer(
  state: PublishPanelState,
  action: PublishPanelAction
): PublishPanelState {
  switch (action.type) {
    case 'SET_VIDEO_PATH':
      return { ...state, videoPath: action.path };

    case 'SET_THUMBNAIL_PATH':
      return { ...state, thumbnailPath: action.path };

    case 'TOGGLE_PLATFORM': {
      const idx = state.selectedPlatforms.indexOf(action.platform);
      const selected = idx >= 0
        ? state.selectedPlatforms.filter(p => p !== action.platform)
        : [...state.selectedPlatforms, action.platform];
      return { ...state, selectedPlatforms: selected };
    }

    case 'SELECT_ALL_PLATFORMS':
      return { ...state, selectedPlatforms: ['youtube', 'bilibili', 'douyin', 'xiaohongshu'] };

    case 'DESELECT_ALL_PLATFORMS':
      return { ...state, selectedPlatforms: [] };

    case 'UPDATE_BASE_METADATA':
      return { ...state, baseMetadata: { ...state.baseMetadata, ...action.updates } };

    case 'SET_MODE':
      return { ...state, mode: action.mode, scheduledAt: action.scheduledAt };

    case 'SET_AUTH_TOKEN': {
      const tokens = new Map(state.authTokens);
      tokens.set(action.token.platform, action.token);
      return { ...state, authTokens: tokens };
    }

    case 'REMOVE_AUTH_TOKEN': {
      const tokens = new Map(state.authTokens);
      tokens.delete(action.platform);
      return { ...state, authTokens: tokens };
    }

    case 'SET_AI_CONTENT': {
      const states = new Map(state.platformStates);
      const existing = states.get(action.platform) ?? {
        platform: action.platform,
        useAIContent: true,
      };
      states.set(action.platform, { ...existing, aiContent: action.content });
      return { ...state, platformStates: states };
    }

    case 'TOGGLE_USE_AI_CONTENT': {
      const states = new Map(state.platformStates);
      const existing = states.get(action.platform);
      if (existing) {
        states.set(action.platform, { ...existing, useAIContent: !existing.useAIContent });
      }
      return { ...state, platformStates: states };
    }

    case 'START_GENERATING_CONTENT':
      return { ...state, phase: 'generating_content', error: undefined };

    case 'CONTENT_GENERATED':
      return { ...state, phase: 'configuring' };

    case 'START_UPLOAD':
      return { ...state, phase: 'uploading', error: undefined };

    case 'UPDATE_PROGRESS': {
      const states = new Map(state.platformStates);
      const existing = states.get(action.platform) ?? {
        platform: action.platform,
        useAIContent: false,
      };
      states.set(action.platform, { ...existing, progress: action.event });
      return { ...state, platformStates: states };
    }

    case 'UPLOAD_COMPLETE': {
      const states = new Map(state.platformStates);
      const existing = states.get(action.platform) ?? {
        platform: action.platform,
        useAIContent: false,
      };
      states.set(action.platform, { ...existing, result: action.result, progress: undefined });
      return { ...state, platformStates: states };
    }

    case 'ALL_UPLOADS_COMPLETE':
      return { ...state, phase: 'complete' };

    case 'SET_ERROR':
      return { ...state, phase: 'error', error: action.error };

    case 'CLEAR_ERROR':
      return { ...state, error: undefined, phase: state.phase === 'error' ? 'idle' : state.phase };

    case 'RESET':
      return createInitialPublishState();

    default:
      return state;
  }
}

// ─── Selectors ──────────────────────────────────────────────────

/** Get platforms that have valid auth tokens */
export function getAuthenticatedPlatforms(state: PublishPanelState): PlatformId[] {
  return state.selectedPlatforms.filter(p => {
    const token = state.authTokens.get(p);
    return token && token.expiresAt > Date.now();
  });
}

/** Get platforms that need authentication */
export function getUnauthenticatedPlatforms(state: PublishPanelState): PlatformId[] {
  return state.selectedPlatforms.filter(p => {
    const token = state.authTokens.get(p);
    return !token || token.expiresAt <= Date.now();
  });
}

/** Build the publish request from current state */
export function buildPublishRequest(state: PublishPanelState): MultiPlatformPublishRequest | null {
  if (!state.videoPath || state.selectedPlatforms.length === 0) return null;

  return {
    platforms: state.selectedPlatforms,
    videoPath: state.videoPath,
    thumbnailPath: state.thumbnailPath,
    metadata: state.baseMetadata,
    mode: state.mode,
    scheduledAt: state.scheduledAt,
  };
}

/** Get effective metadata for a platform (AI content or base) */
export function getEffectiveMetadata(
  state: PublishPanelState,
  platform: PlatformId
): PlatformVideoMetadata {
  const platformState = state.platformStates.get(platform);

  if (platformState?.useAIContent && platformState.aiContent) {
    return {
      ...state.baseMetadata,
      title: platformState.aiContent.title,
      description: platformState.aiContent.description,
      tags: platformState.aiContent.tags,
      hashtags: platformState.aiContent.hashtags,
      category: platformState.aiContent.category,
      language: platformState.aiContent.language,
    };
  }

  return state.baseMetadata;
}

/** Get upload progress summary */
export function getUploadProgressSummary(state: PublishPanelState): {
  total: number;
  completed: number;
  uploading: number;
  failed: number;
  overallPercent: number;
} {
  const total = state.selectedPlatforms.length;
  let completed = 0;
  let uploading = 0;
  let failed = 0;
  let totalPercent = 0;

  for (const platform of state.selectedPlatforms) {
    const ps = state.platformStates.get(platform);
    if (ps?.result) {
      if (ps.result.success) completed++;
      else failed++;
      totalPercent += 100;
    } else if (ps?.progress) {
      uploading++;
      totalPercent += ps.progress.percent;
    }
  }

  return {
    total,
    completed,
    uploading,
    failed,
    overallPercent: total > 0 ? Math.round(totalPercent / total) : 0,
  };
}

/** Get platform display info */
export function getPlatformDisplay(platform: PlatformId): {
  name: string;
  maxTitle: number;
  maxDesc: number;
  maxTags: number;
} {
  const spec = PLATFORM_SPECS[platform];
  return {
    name: spec.name,
    maxTitle: spec.maxTitleLength,
    maxDesc: spec.maxDescriptionLength,
    maxTags: spec.maxTags,
  };
}
