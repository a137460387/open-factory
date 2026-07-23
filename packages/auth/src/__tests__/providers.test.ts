import { describe, it, expect, beforeEach } from 'vitest';
import { OIDCProvider, SAMLProvider } from '../providers.js';
import type { SSOProviderConfig } from '../types.js';

describe('OIDCProvider', () => {
  let provider: OIDCProvider;
  const config: SSOProviderConfig = {
    id: 'google',
    name: 'Google',
    type: 'oidc',
    enabled: true,
    oidc: {
      issuer: 'https://accounts.google.com',
      clientId: 'test-client-id',
      clientSecret: 'test-secret',
      redirectUri: 'https://app.example.com/callback',
    },
  };

  beforeEach(async () => {
    provider = new OIDCProvider('google');
    await provider.initialize(config);
  });

  it('has correct provider type', () => {
    expect(provider.providerType).toBe('oidc');
  });

  it('has correct provider id', () => {
    expect(provider.providerId).toBe('google');
  });

  it('generates login URL with correct params', async () => {
    const url = await provider.getLoginUrl('test-state');
    expect(url).toContain('accounts.google.com/authorize');
    expect(url).toContain('client_id=test-client-id');
    expect(url).toContain('state=test-state');
    expect(url).toContain('response_type=code');
  });

  it('generates login URL with default scopes', async () => {
    const url = await provider.getLoginUrl('state');
    expect(url).toContain('scope=');
    expect(url).toContain('openid');
  });

  it('throws when not initialized', async () => {
    const uninitialized = new OIDCProvider('test');
    await expect(uninitialized.getLoginUrl('state')).rejects.toThrow('not initialized');
  });

  it('throws when OIDC config is missing', async () => {
    const badProvider = new OIDCProvider('test');
    await expect(
      badProvider.initialize({ id: 'test', name: 'Test', type: 'oidc', enabled: true })
    ).rejects.toThrow('OIDC config missing');
  });

  it('throws when callback has no code', async () => {
    await expect(provider.handleCallback({})).rejects.toThrow('code');
  });

  it('handles callback with code', async () => {
    const session = await provider.handleCallback({ code: 'auth-code-123' });
    expect(session.provider).toBe('google');
    expect(session.accessToken).toBeDefined();
    expect(session.expiresAt).toBeGreaterThan(Date.now());
  });

  it('logout is a no-op', async () => {
    const session = await provider.handleCallback({ code: 'test' });
    await expect(provider.logout(session)).resolves.toBeUndefined();
  });
});

describe('SAMLProvider', () => {
  let provider: SAMLProvider;
  const config: SSOProviderConfig = {
    id: 'okta',
    name: 'Okta',
    type: 'saml',
    enabled: true,
    saml: {
      entryPoint: 'https://okta.example.com/sso',
      issuer: 'https://app.example.com',
      cert: 'test-cert',
      callbackUrl: 'https://app.example.com/callback',
    },
  };

  beforeEach(async () => {
    provider = new SAMLProvider('okta');
    await provider.initialize(config);
  });

  it('has correct provider type', () => {
    expect(provider.providerType).toBe('saml');
  });

  it('returns entry point as login URL', async () => {
    const url = await provider.getLoginUrl('state');
    expect(url).toBe('https://okta.example.com/sso');
  });

  it('throws when SAML config is missing', async () => {
    const badProvider = new SAMLProvider('test');
    await expect(
      badProvider.initialize({ id: 'test', name: 'Test', type: 'saml', enabled: true })
    ).rejects.toThrow('SAML config missing');
  });

  it('handles callback', async () => {
    const session = await provider.handleCallback({ SAMLResponse: 'test' });
    expect(session.provider).toBe('okta');
    expect(session.expiresAt).toBeGreaterThan(Date.now());
  });

  it('logout is a no-op', async () => {
    const session = await provider.handleCallback({});
    await expect(provider.logout(session)).resolves.toBeUndefined();
  });
});
