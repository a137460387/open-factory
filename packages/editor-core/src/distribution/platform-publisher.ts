/**
 * Platform Publisher
 *
 * Manages local OAuth authorization and video upload to multiple platforms.
 * Integrates with LLM orchestrator for AI-generated metadata.
 *
 * Supported platforms:
 * - YouTube (via YouTube Data API v3)
 * - Bilibili (via bilibili API)
 * - Douyin (via TikTok API)
 * - Xiaohongshu (via XHS API)
 *
 * Privacy: Only uploads the final rendered video file and metadata.
 * Raw source materials never leave the device.
 */

// ─── Platform Definitions ───────────────────────────────────────

export type PlatformId = 'youtube' | 'bilibili' | 'douyin' | 'xiaohongshu' | 'custom';

export interface PlatformAuthConfig {
  platform: PlatformId;
  clientId: string;
  clientSecret?: string;
  redirectUri: string;
  scopes: string[];
}

export interface PlatformAuthToken {
  platform: PlatformId;
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  scopes: string[];
}

export interface PlatformUploadConfig {
  /** Video file path (local) */
  videoPath: string;
  /** Thumbnail image path (local, optional) */
  thumbnailPath?: string;
  /** Platform-specific metadata */
  metadata: PlatformVideoMetadata;
  /** Upload chunk size in bytes (default 10MB) */
  chunkSizeBytes?: number;
  /** Progress callback */
  onProgress?: (event: UploadProgressEvent) => void;
}

export interface PlatformVideoMetadata {
  title: string;
  description: string;
  tags: string[];
  category?: string;
  language?: string;
  visibility: 'public' | 'unlisted' | 'private';
  /** Platform-specific hashtags */
  hashtags?: string[];
  /** Scheduled publish time (ISO string) */
  scheduledAt?: string;
}

export interface UploadProgressEvent {
  /** Bytes uploaded */
  uploadedBytes: number;
  /** Total bytes */
  totalBytes: number;
  /** Progress percentage 0-100 */
  percent: number;
  /** Current phase */
  phase: 'preparing' | 'uploading' | 'processing' | 'done' | 'error';
  /** Platform-specific status message */
  message?: string;
}

export interface UploadResult {
  platform: PlatformId;
  success: boolean;
  /** Platform video ID (if successful) */
  videoId?: string;
  /** Platform video URL (if successful) */
  videoUrl?: string;
  /** Error message (if failed) */
  error?: string;
  /** Upload duration in ms */
  durationMs: number;
}

// ─── Platform Specs ─────────────────────────────────────────────

export interface PlatformSpec {
  id: PlatformId;
  name: string;
  /** Max title length */
  maxTitleLength: number;
  /** Max description length */
  maxDescriptionLength: number;
  /** Max tags */
  maxTags: number;
  /** Max tag length */
  maxTagLength: number;
  /** Max video size in bytes */
  maxVideoSizeBytes: number;
  /** Supported video formats */
  supportedFormats: string[];
  /** Supported categories */
  categories: string[];
  /** Auth endpoint */
  authUrl: string;
  /** Token endpoint */
  tokenUrl: string;
  /** Upload endpoint */
  uploadUrl: string;
}

export const PLATFORM_SPECS: Record<PlatformId, PlatformSpec> = {
  youtube: {
    id: 'youtube',
    name: 'YouTube',
    maxTitleLength: 100,
    maxDescriptionLength: 5000,
    maxTags: 500, // YouTube uses comma-separated, 500 chars total
    maxTagLength: 30,
    maxVideoSizeBytes: 128 * 1024 * 1024 * 1024, // 128GB
    supportedFormats: ['mp4', 'mov', 'avi', 'wmv', 'flv', 'webm'],
    categories: ['Film & Animation', 'Autos & Vehicles', 'Music', 'Pets & Animals', 'Sports', 'Short Movies', 'Travel & Events', 'Gaming', 'Videoblogging', 'People & Blogs', 'Comedy', 'Entertainment', 'News & Politics', 'Howto & Style', 'Education', 'Science & Technology', 'Nonprofits & Activism'],
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    uploadUrl: 'https://www.googleapis.com/upload/youtube/v3/videos',
  },
  bilibili: {
    id: 'bilibili',
    name: 'Bilibili',
    maxTitleLength: 80,
    maxDescriptionLength: 2000,
    maxTags: 12,
    maxTagLength: 20,
    maxVideoSizeBytes: 8 * 1024 * 1024 * 1024, // 8GB
    supportedFormats: ['mp4', 'flv', 'avi', 'wmv', 'mov', 'webm', 'mkv', 'ts'],
    categories: ['生活', '美食', '游戏', '知识', '影视', '娱乐', '动画', '音乐', '舞蹈', '科技', '运动', '汽车', '时尚', '动物圈'],
    authUrl: 'https://account.bilibili.com/oauth2/authorize',
    tokenUrl: 'https://member.bilibili.com/x/oauth2/access_token',
    uploadUrl: 'https://member.bilibili.com/x/client/archive/upload',
  },
  douyin: {
    id: 'douyin',
    name: 'Douyin',
    maxTitleLength: 55,
    maxDescriptionLength: 1000,
    maxTags: 5,
    maxTagLength: 20,
    maxVideoSizeBytes: 4 * 1024 * 1024 * 1024, // 4GB
    supportedFormats: ['mp4', 'mov'],
    categories: ['日常', '美食', '旅行', '知识', '游戏', '娱乐', '体育', '时尚', '剧情', '动画'],
    authUrl: 'https://open.douyin.com/platform/oauth/connect',
    tokenUrl: 'https://open.douyin.com/oauth/access_token',
    uploadUrl: 'https://open.douyin.com/video/upload',
  },
  xiaohongshu: {
    id: 'xiaohongshu',
    name: 'Xiaohongshu',
    maxTitleLength: 20,
    maxDescriptionLength: 1000,
    maxTags: 10,
    maxTagLength: 15,
    maxVideoSizeBytes: 2 * 1024 * 1024 * 1024, // 2GB
    supportedFormats: ['mp4', 'mov'],
    categories: ['日常', '美妆', '穿搭', '美食', '旅行', '学习', '健身', '数码', '家居', '宠物'],
    authUrl: 'https://creator.xiaohongshu.com/api/oauth/authorize',
    tokenUrl: 'https://creator.xiaohongshu.com/api/oauth/token',
    uploadUrl: 'https://creator.xiaohongshu.com/api/upload/video',
  },
  custom: {
    id: 'custom',
    name: 'Custom Platform',
    maxTitleLength: 200,
    maxDescriptionLength: 10000,
    maxTags: 50,
    maxTagLength: 50,
    maxVideoSizeBytes: 10 * 1024 * 1024 * 1024,
    supportedFormats: ['mp4', 'mov', 'avi', 'webm', 'mkv'],
    categories: [],
    authUrl: '',
    tokenUrl: '',
    uploadUrl: '',
  },
};

// ─── Validation ─────────────────────────────────────────────────

export interface PublishValidationError {
  field: string;
  message: string;
  platform: PlatformId;
}

/**
 * Validate upload config against platform specs.
 */
export function validateUploadConfig(
  config: PlatformUploadConfig,
  platform: PlatformId
): PublishValidationError[] {
  const spec = PLATFORM_SPECS[platform];
  const errors: PublishValidationError[] = [];
  const { metadata } = config;

  if (!metadata.title || metadata.title.trim().length === 0) {
    errors.push({ field: 'title', message: 'Title is required', platform });
  } else if (metadata.title.length > spec.maxTitleLength) {
    errors.push({ field: 'title', message: `Title exceeds ${spec.maxTitleLength} chars`, platform });
  }

  if (metadata.description && metadata.description.length > spec.maxDescriptionLength) {
    errors.push({ field: 'description', message: `Description exceeds ${spec.maxDescriptionLength} chars`, platform });
  }

  if (metadata.tags.length > spec.maxTags) {
    errors.push({ field: 'tags', message: `Too many tags (max ${spec.maxTags})`, platform });
  }

  for (const tag of metadata.tags) {
    if (tag.length > spec.maxTagLength) {
      errors.push({ field: 'tags', message: `Tag "${tag}" exceeds ${spec.maxTagLength} chars`, platform });
    }
  }

  return errors;
}

/**
 * Adapt metadata to platform-specific constraints.
 * Truncates fields, adjusts tags, etc.
 */
export function adaptMetadataForPlatform(
  metadata: PlatformVideoMetadata,
  platform: PlatformId
): PlatformVideoMetadata {
  const spec = PLATFORM_SPECS[platform];

  return {
    ...metadata,
    title: metadata.title.substring(0, spec.maxTitleLength),
    description: metadata.description.substring(0, spec.maxDescriptionLength),
    tags: metadata.tags
      .slice(0, spec.maxTags)
      .map(tag => tag.substring(0, spec.maxTagLength)),
  };
}

// ─── OAuth Flow ─────────────────────────────────────────────────

/**
 * Generate OAuth authorization URL for a platform.
 */
export function buildAuthUrl(config: PlatformAuthConfig, state: string): string {
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: 'code',
    scope: config.scopes.join(' '),
    state,
  });

  const spec = PLATFORM_SPECS[config.platform];
  return `${spec.authUrl}?${params.toString()}`;
}

/**
 * Parse OAuth callback URL to extract authorization code.
 */
export function parseAuthCallback(url: string): { code: string; state: string } | { error: string } {
  try {
    const parsed = new URL(url);
    const code = parsed.searchParams.get('code');
    const state = parsed.searchParams.get('state');
    const error = parsed.searchParams.get('error');

    if (error) {
      return { error };
    }
    if (!code || !state) {
      return { error: 'Missing code or state parameter' };
    }

    return { code, state };
  } catch {
    return { error: 'Invalid callback URL' };
  }
}

/**
 * Check if an auth token is expired.
 */
export function isTokenExpired(token: PlatformAuthToken, bufferMs = 60_000): boolean {
  return Date.now() >= token.expiresAt - bufferMs;
}

// ─── Upload Manager ─────────────────────────────────────────────

export interface PlatformPublisherConfig {
  /** Stored auth tokens per platform */
  tokens: Map<PlatformId, PlatformAuthToken>;
  /** Default chunk size */
  defaultChunkSizeBytes?: number;
  /** Max concurrent uploads */
  maxConcurrent?: number;
}

const DEFAULT_CHUNK_SIZE = 10 * 1024 * 1024; // 10MB

/**
 * Build upload headers for a platform.
 */
export function buildUploadHeaders(
  token: PlatformAuthToken,
  platform: PlatformId
): Record<string, string> {
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${token.accessToken}`,
  };

  if (platform === 'bilibili') {
    headers['Content-Type'] = 'application/json';
  }

  return headers;
}

/**
 * Calculate chunk boundaries for a file upload.
 */
export function calculateChunks(
  totalBytes: number,
  chunkSize: number
): Array<{ start: number; end: number; index: number }> {
  const chunks: Array<{ start: number; end: number; index: number }> = [];
  let offset = 0;
  let index = 0;

  while (offset < totalBytes) {
    const end = Math.min(offset + chunkSize - 1, totalBytes - 1);
    chunks.push({ start: offset, end, index });
    offset = end + 1;
    index++;
  }

  return chunks;
}

/**
 * Generate a unique publish job ID.
 */
export function generatePublishJobId(platform: PlatformId): string {
  return `${platform}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

// ─── Multi-Platform Orchestrator ────────────────────────────────

export interface MultiPlatformPublishRequest {
  /** Platforms to publish to */
  platforms: PlatformId[];
  /** Video file path */
  videoPath: string;
  /** Thumbnail path */
  thumbnailPath?: string;
  /** Base metadata (will be adapted per platform) */
  metadata: PlatformVideoMetadata;
  /** Publish mode */
  mode: 'immediate' | 'scheduled';
  /** Scheduled time (if mode is scheduled) */
  scheduledAt?: string;
}

export interface MultiPlatformPublishResult {
  /** Total platforms */
  total: number;
  /** Successful uploads */
  succeeded: number;
  /** Failed uploads */
  failed: number;
  /** Results per platform */
  results: UploadResult[];
}

/**
 * Validate a multi-platform publish request.
 */
export function validateMultiPlatformRequest(
  request: MultiPlatformPublishRequest
): PublishValidationError[] {
  const errors: PublishValidationError[] = [];

  if (request.platforms.length === 0) {
    errors.push({ field: 'platforms', message: 'At least one platform required', platform: 'custom' });
  }

  if (!request.videoPath) {
    errors.push({ field: 'videoPath', message: 'Video path required', platform: 'custom' });
  }

  if (request.mode === 'scheduled' && !request.scheduledAt) {
    errors.push({ field: 'scheduledAt', message: 'Scheduled time required for scheduled mode', platform: 'custom' });
  }

  for (const platform of request.platforms) {
    const adapted = adaptMetadataForPlatform(request.metadata, platform);
    const config: PlatformUploadConfig = {
      videoPath: request.videoPath,
      thumbnailPath: request.thumbnailPath,
      metadata: adapted,
    };
    errors.push(...validateUploadConfig(config, platform));
  }

  return errors;
}

/**
 * Adapt metadata for all target platforms.
 */
export function adaptMetadataForAllPlatforms(
  metadata: PlatformVideoMetadata,
  platforms: PlatformId[]
): Map<PlatformId, PlatformVideoMetadata> {
  const result = new Map<PlatformId, PlatformVideoMetadata>();
  for (const platform of platforms) {
    result.set(platform, adaptMetadataForPlatform(metadata, platform));
  }
  return result;
}
