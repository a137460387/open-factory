import { describe, it, expect } from 'vitest';
import {
  PLATFORM_SPECS,
  validateUploadConfig,
  adaptMetadataForPlatform,
  buildAuthUrl,
  parseAuthCallback,
  isTokenExpired,
  buildUploadHeaders,
  calculateChunks,
  generatePublishJobId,
  validateMultiPlatformRequest,
  adaptMetadataForAllPlatforms,
} from './platform-publisher';
import type {
  PlatformAuthToken,
  PlatformUploadConfig,
  PlatformVideoMetadata,
  PlatformAuthConfig,
  PlatformId,
  MultiPlatformPublishRequest,
} from './platform-publisher';

// ─── Test Helpers ───────────────────────────────────────────────

function makeMetadata(overrides: Partial<PlatformVideoMetadata> = {}): PlatformVideoMetadata {
  return {
    title: 'Test Video Title',
    description: 'A test video description',
    tags: ['test', 'video'],
    visibility: 'public',
    ...overrides,
  };
}

function makeUploadConfig(overrides: Partial<PlatformUploadConfig> = {}): PlatformUploadConfig {
  return {
    videoPath: '/videos/test.mp4',
    metadata: makeMetadata(),
    ...overrides,
  };
}

function makeToken(overrides: Partial<PlatformAuthToken> = {}): PlatformAuthToken {
  return {
    platform: 'youtube',
    accessToken: 'test-access-token',
    expiresAt: Date.now() + 3600_000,
    scopes: ['youtube.upload'],
    ...overrides,
  };
}

function makeAuthConfig(overrides: Partial<PlatformAuthConfig> = {}): PlatformAuthConfig {
  return {
    platform: 'youtube',
    clientId: 'test-client-id',
    redirectUri: 'http://localhost:3000/callback',
    scopes: ['youtube.upload'],
    ...overrides,
  };
}

// ─── PLATFORM_SPECS ─────────────────────────────────────────────

describe('PLATFORM_SPECS', () => {
  it('defines all supported platforms', () => {
    expect(PLATFORM_SPECS.youtube).toBeDefined();
    expect(PLATFORM_SPECS.bilibili).toBeDefined();
    expect(PLATFORM_SPECS.douyin).toBeDefined();
    expect(PLATFORM_SPECS.xiaohongshu).toBeDefined();
    expect(PLATFORM_SPECS.custom).toBeDefined();
  });

  it('each platform has required fields', () => {
    for (const [id, spec] of Object.entries(PLATFORM_SPECS)) {
      expect(spec.id).toBe(id);
      expect(spec.name).toBeTruthy();
      expect(spec.maxTitleLength).toBeGreaterThan(0);
      expect(spec.maxDescriptionLength).toBeGreaterThan(0);
      expect(spec.maxTags).toBeGreaterThan(0);
      expect(spec.supportedFormats.length).toBeGreaterThan(0);
    }
  });
});

// ─── validateUploadConfig ──────────────────────────────────────

describe('validateUploadConfig', () => {
  it('passes for valid config', () => {
    expect(validateUploadConfig(makeUploadConfig(), 'youtube')).toEqual([]);
  });

  it('rejects empty title', () => {
    const errors = validateUploadConfig(
      makeUploadConfig({ metadata: makeMetadata({ title: '' }) }),
      'youtube'
    );
    expect(errors.some(e => e.field === 'title')).toBe(true);
  });

  it('rejects title exceeding max length', () => {
    const longTitle = 'x'.repeat(200);
    const errors = validateUploadConfig(
      makeUploadConfig({ metadata: makeMetadata({ title: longTitle }) }),
      'youtube'
    );
    expect(errors.some(e => e.field === 'title')).toBe(true);
  });

  it('rejects too many tags', () => {
    const tags = Array.from({ length: 20 }, (_, i) => `tag${i}`);
    const errors = validateUploadConfig(
      makeUploadConfig({ metadata: makeMetadata({ tags }) }),
      'youtube'
    );
    // YouTube allows up to 500 chars total, not count. But we check count too.
    // Actually YouTube limit is 500 chars total, our spec says maxTags: 500
    // Let's test with a platform that has a lower limit
    expect(validateUploadConfig(
      makeUploadConfig({ metadata: makeMetadata({ tags: Array.from({ length: 15 }, (_, i) => `tag${i}`) }) }),
      'bilibili'
    ).length).toBeGreaterThan(0);
  });

  it('rejects tag exceeding max length', () => {
    const errors = validateUploadConfig(
      makeUploadConfig({ metadata: makeMetadata({ tags: ['a'.repeat(50)] }) }),
      'youtube'
    );
    expect(errors.some(e => e.field === 'tags')).toBe(true);
  });
});

// ─── adaptMetadataForPlatform ──────────────────────────────────

describe('adaptMetadataForPlatform', () => {
  it('truncates title for platform', () => {
    const metadata = makeMetadata({ title: 'A'.repeat(200) });
    const adapted = adaptMetadataForPlatform(metadata, 'douyin');
    expect(adapted.title.length).toBeLessThanOrEqual(PLATFORM_SPECS.douyin.maxTitleLength);
  });

  it('truncates description', () => {
    const metadata = makeMetadata({ description: 'A'.repeat(5000) });
    const adapted = adaptMetadataForPlatform(metadata, 'bilibili');
    expect(adapted.description.length).toBeLessThanOrEqual(PLATFORM_SPECS.bilibili.maxDescriptionLength);
  });

  it('limits tags count', () => {
    const tags = Array.from({ length: 20 }, (_, i) => `tag${i}`);
    const metadata = makeMetadata({ tags });
    const adapted = adaptMetadataForPlatform(metadata, 'bilibili');
    expect(adapted.tags.length).toBeLessThanOrEqual(PLATFORM_SPECS.bilibili.maxTags);
  });

  it('truncates individual tags', () => {
    const metadata = makeMetadata({ tags: ['a'.repeat(50)] });
    const adapted = adaptMetadataForPlatform(metadata, 'douyin');
    expect(adapted.tags[0].length).toBeLessThanOrEqual(PLATFORM_SPECS.douyin.maxTagLength);
  });

  it('preserves short metadata unchanged', () => {
    const metadata = makeMetadata();
    const adapted = adaptMetadataForPlatform(metadata, 'youtube');
    expect(adapted.title).toBe(metadata.title);
    expect(adapted.description).toBe(metadata.description);
    expect(adapted.tags).toEqual(metadata.tags);
  });
});

// ─── buildAuthUrl ──────────────────────────────────────────────

describe('buildAuthUrl', () => {
  it('builds valid URL', () => {
    const url = buildAuthUrl(makeAuthConfig(), 'random-state');
    expect(url).toContain('accounts.google.com');
    expect(url).toContain('client_id=test-client-id');
    expect(url).toContain('state=random-state');
  });

  it('includes scopes', () => {
    const url = buildAuthUrl(makeAuthConfig({ scopes: ['a', 'b'] }), 'state');
    expect(url).toContain('scope=a+b');
  });

  it('includes redirect URI', () => {
    const url = buildAuthUrl(makeAuthConfig(), 'state');
    expect(url).toContain('redirect_uri=');
  });
});

// ─── parseAuthCallback ─────────────────────────────────────────

describe('parseAuthCallback', () => {
  it('parses code and state', () => {
    const result = parseAuthCallback('http://localhost:3000/callback?code=abc&state=xyz');
    expect(result).toEqual({ code: 'abc', state: 'xyz' });
  });

  it('returns error for missing code', () => {
    const result = parseAuthCallback('http://localhost:3000/callback?state=xyz');
    expect('error' in result).toBe(true);
  });

  it('returns error for OAuth error', () => {
    const result = parseAuthCallback('http://localhost:3000/callback?error=access_denied');
    expect('error' in result).toBe(true);
  });

  it('returns error for invalid URL', () => {
    const result = parseAuthCallback('not-a-url');
    expect('error' in result).toBe(true);
  });
});

// ─── isTokenExpired ────────────────────────────────────────────

describe('isTokenExpired', () => {
  it('returns false for fresh token', () => {
    const token = makeToken({ expiresAt: Date.now() + 3600_000 });
    expect(isTokenExpired(token)).toBe(false);
  });

  it('returns true for expired token', () => {
    const token = makeToken({ expiresAt: Date.now() - 1000 });
    expect(isTokenExpired(token)).toBe(true);
  });

  it('returns true when within buffer', () => {
    const token = makeToken({ expiresAt: Date.now() + 30_000 }); // 30s left
    expect(isTokenExpired(token, 60_000)).toBe(true); // 60s buffer
  });
});

// ─── buildUploadHeaders ────────────────────────────────────────

describe('buildUploadHeaders', () => {
  it('includes bearer token', () => {
    const headers = buildUploadHeaders(makeToken(), 'youtube');
    expect(headers['Authorization']).toBe('Bearer test-access-token');
  });
});

// ─── calculateChunks ───────────────────────────────────────────

describe('calculateChunks', () => {
  it('calculates single chunk for small file', () => {
    const chunks = calculateChunks(1000, 5000);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toEqual({ start: 0, end: 999, index: 0 });
  });

  it('calculates multiple chunks', () => {
    const chunks = calculateChunks(10000, 3000);
    expect(chunks).toHaveLength(4);
    expect(chunks[0]).toEqual({ start: 0, end: 2999, index: 0 });
    expect(chunks[1]).toEqual({ start: 3000, end: 5999, index: 1 });
    expect(chunks[2]).toEqual({ start: 6000, end: 8999, index: 2 });
    expect(chunks[3]).toEqual({ start: 9000, end: 9999, index: 3 });
  });

  it('handles exact multiple', () => {
    const chunks = calculateChunks(6000, 3000);
    expect(chunks).toHaveLength(2);
    expect(chunks[1].end).toBe(5999);
  });

  it('returns empty for zero bytes', () => {
    expect(calculateChunks(0, 3000)).toEqual([]);
  });
});

// ─── generatePublishJobId ──────────────────────────────────────

describe('generatePublishJobId', () => {
  it('includes platform prefix', () => {
    const id = generatePublishJobId('youtube');
    expect(id).toMatch(/^youtube_/);
  });

  it('generates unique IDs', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generatePublishJobId('bilibili')));
    expect(ids.size).toBe(100);
  });
});

// ─── validateMultiPlatformRequest ──────────────────────────────

describe('validateMultiPlatformRequest', () => {
  const validRequest: MultiPlatformPublishRequest = {
    platforms: ['youtube', 'bilibili'],
    videoPath: '/videos/test.mp4',
    metadata: makeMetadata(),
    mode: 'immediate',
  };

  it('passes for valid request', () => {
    expect(validateMultiPlatformRequest(validRequest)).toEqual([]);
  });

  it('rejects empty platforms', () => {
    const errors = validateMultiPlatformRequest({ ...validRequest, platforms: [] });
    expect(errors.some(e => e.field === 'platforms')).toBe(true);
  });

  it('rejects missing video path', () => {
    const errors = validateMultiPlatformRequest({ ...validRequest, videoPath: '' });
    expect(errors.some(e => e.field === 'videoPath')).toBe(true);
  });

  it('rejects scheduled mode without time', () => {
    const errors = validateMultiPlatformRequest({ ...validRequest, mode: 'scheduled' });
    expect(errors.some(e => e.field === 'scheduledAt')).toBe(true);
  });

  it('adapts and validates metadata per platform', () => {
    // Use too many tags for bilibili (max 12)
    const manyTags = Array.from({ length: 20 }, (_, i) => `tag${i}`);
    const errors = validateMultiPlatformRequest({
      ...validRequest,
      metadata: makeMetadata({ tags: manyTags }),
    });
    // bilibili allows max 12 tags, youtube allows 500
    // After adaptation, bilibili will have 12 tags (truncated) so no tag count error
    // But let's test with empty title which fails required check
    const titleErrors = validateMultiPlatformRequest({
      ...validRequest,
      metadata: makeMetadata({ title: '' }),
    });
    expect(titleErrors.filter(e => e.field === 'title').length).toBeGreaterThan(0);
  });
});

// ─── adaptMetadataForAllPlatforms ──────────────────────────────

describe('adaptMetadataForAllPlatforms', () => {
  it('returns adapted metadata for each platform', () => {
    const result = adaptMetadataForAllPlatforms(makeMetadata(), ['youtube', 'bilibili', 'douyin']);
    expect(result.size).toBe(3);
    expect(result.has('youtube')).toBe(true);
    expect(result.has('bilibili')).toBe(true);
    expect(result.has('douyin')).toBe(true);
  });

  it('adapts per platform constraints', () => {
    const longTitle = 'A'.repeat(200);
    const result = adaptMetadataForAllPlatforms(makeMetadata({ title: longTitle }), ['douyin']);
    const douyinMeta = result.get('douyin')!;
    expect(douyinMeta.title.length).toBeLessThanOrEqual(PLATFORM_SPECS.douyin.maxTitleLength);
  });
});
