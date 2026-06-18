import { describe, expect, it } from 'vitest';
import {
  checkForAvailableUpdate,
  compareSemanticVersions,
  parseReleaseNotesPayload,
  parseUpdateEndpointPayload,
  shouldPromptForUpdate
} from './update-check';

describe('update check', () => {
  it('compares semantic versions for update prompts', () => {
    expect(compareSemanticVersions('0.6.0', '0.6.1')).toBe(-1);
    expect(compareSemanticVersions('1.2.0', '1.2.0')).toBe(0);
    expect(compareSemanticVersions('2.0.0', '1.9.9')).toBe(1);
    expect(shouldPromptForUpdate('0.6.0', '0.7.0')).toBe(true);
    expect(shouldPromptForUpdate('0.7.0', '0.6.9')).toBe(false);
  });

  it('parses updater endpoint payload fields', () => {
    expect(
      parseUpdateEndpointPayload({
        version: 'v2.4.0',
        notes: 'Timeline virtualization and updater support.',
        pub_date: '2026-06-18T00:00:00Z',
        platforms: {}
      })
    ).toEqual({
      version: '2.4.0',
      body: 'Timeline virtualization and updater support.',
      date: '2026-06-18T00:00:00Z',
      url: undefined
    });
  });

  it('parses GitHub release notes payloads', () => {
    expect(
      parseReleaseNotesPayload({
        tag_name: 'v2.4.0',
        body: 'Release notes',
        html_url: 'https://github.com/open-factory/open-factory/releases/tag/v2.4.0',
        published_at: '2026-06-18T01:02:03Z'
      })
    ).toEqual({
      version: '2.4.0',
      body: 'Release notes',
      url: 'https://github.com/open-factory/open-factory/releases/tag/v2.4.0',
      publishedAt: '2026-06-18T01:02:03Z'
    });
  });

  it('returns no update when startup checks are disabled', async () => {
    await expect(
      checkForAvailableUpdate({ autoCheckEnabled: false }, '0.6.0', {
        fetchJson: async () => ({ version: '9.9.9' })
      })
    ).resolves.toBeUndefined();
  });

  it('returns an update notice from a mocked endpoint and release notes API', async () => {
    const fetched: string[] = [];
    const notice = await checkForAvailableUpdate({ autoCheckEnabled: true, customEndpoint: 'https://updates.example.test/latest.json' }, '0.6.0', {
      fetchJson: async (url) => {
        fetched.push(url);
        return { version: '0.6.1', notes: 'Endpoint notes' };
      }
    });

    expect(notice).toMatchObject({
      currentVersion: '0.6.0',
      version: '0.6.1',
      releaseNotes: 'Endpoint notes',
      source: 'endpoint'
    });
    expect(fetched).toEqual(['https://updates.example.test/latest.json']);
  });

  it('uses release notes from GitHub API for the default endpoint', async () => {
    const notice = await checkForAvailableUpdate({ autoCheckEnabled: true }, '0.6.0', {
      fetchJson: async (url) =>
        url.includes('api.github.com')
          ? { tag_name: 'v0.6.1', body: 'GitHub release notes', html_url: 'https://github.com/open-factory/open-factory/releases/tag/v0.6.1' }
          : { version: '0.6.1', notes: 'Endpoint notes' }
    });

    expect(notice).toMatchObject({
      version: '0.6.1',
      releaseNotes: 'GitHub release notes',
      releaseUrl: 'https://github.com/open-factory/open-factory/releases/tag/v0.6.1'
    });
  });
});
