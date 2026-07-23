import { describe, it, expect, beforeEach } from 'vitest';
import { SSOManager } from '../sso-manager.js';
import type { SSOProviderConfig } from '../types.js';

describe('SSOManager', () => {
  let manager: SSOManager;

  beforeEach(() => {
    manager = new SSOManager();
  });

  it('should register OIDC provider', async () => {
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

    await manager.registerProvider(config);
    const provider = manager.getProvider('google');
    expect(provider).toBeDefined();
    expect(provider?.providerType).toBe('oidc');
  });

  it('should register SAML provider', async () => {
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

    await manager.registerProvider(config);
    const provider = manager.getProvider('okta');
    expect(provider).toBeDefined();
    expect(provider?.providerType).toBe('saml');
  });

  it('should list registered providers', async () => {
    const oidcConfig: SSOProviderConfig = {
      id: 'google',
      name: 'Google',
      type: 'oidc',
      enabled: true,
      oidc: {
        issuer: 'https://accounts.google.com',
        clientId: 'test',
        clientSecret: 'test',
        redirectUri: 'https://app.example.com/callback',
      },
    };

    await manager.registerProvider(oidcConfig);
    const providers = manager.listProviders();
    expect(providers).toHaveLength(1);
    expect(providers[0].id).toBe('google');
  });

  it('should return undefined for unknown provider', () => {
    expect(manager.getProvider('nonexistent')).toBeUndefined();
  });

  it('should remove provider', async () => {
    const config: SSOProviderConfig = {
      id: 'google',
      name: 'Google',
      type: 'oidc',
      enabled: true,
      oidc: {
        issuer: 'https://accounts.google.com',
        clientId: 'test',
        clientSecret: 'test',
        redirectUri: 'https://app.example.com/callback',
      },
    };

    await manager.registerProvider(config);
    manager.removeProvider('google');
    expect(manager.getProvider('google')).toBeUndefined();
  });

  it('should throw for unsupported provider type', async () => {
    const config = {
      id: 'test',
      name: 'Test',
      type: 'unsupported' as never,
      enabled: true,
    };

    await expect(manager.registerProvider(config)).rejects.toThrow('Unsupported SSO provider type');
  });

  it('should start login flow', async () => {
    const config: SSOProviderConfig = {
      id: 'google',
      name: 'Google',
      type: 'oidc',
      enabled: true,
      oidc: {
        issuer: 'https://accounts.google.com',
        clientId: 'test',
        clientSecret: 'test',
        redirectUri: 'https://app.example.com/callback',
      },
    };

    await manager.registerProvider(config);
    const url = await manager.startLogin('google', 'test-state');
    expect(url).toContain('accounts.google.com');
  });

  it('should throw when starting login for unknown provider', async () => {
    await expect(manager.startLogin('unknown', 'state')).rejects.toThrow('not found');
  });

  it('should handle callback and store session', async () => {
    const config: SSOProviderConfig = {
      id: 'google',
      name: 'Google',
      type: 'oidc',
      enabled: true,
      oidc: {
        issuer: 'https://accounts.google.com',
        clientId: 'test',
        clientSecret: 'test',
        redirectUri: 'https://app.example.com/callback',
      },
    };

    await manager.registerProvider(config);
    const session = await manager.handleCallback('google', { code: 'test-code' });
    expect(session.provider).toBe('google');
    expect(manager.getSession(session.userId)).toBeDefined();
  });

  it('should throw when handling callback for unknown provider', async () => {
    await expect(manager.handleCallback('unknown', {})).rejects.toThrow('not found');
  });

  it('should logout and remove session', async () => {
    const config: SSOProviderConfig = {
      id: 'google',
      name: 'Google',
      type: 'oidc',
      enabled: true,
      oidc: {
        issuer: 'https://accounts.google.com',
        clientId: 'test',
        clientSecret: 'test',
        redirectUri: 'https://app.example.com/callback',
      },
    };

    await manager.registerProvider(config);
    const session = await manager.handleCallback('google', { code: 'test' });
    await manager.logout(session.userId);
    expect(manager.getSession(session.userId)).toBeUndefined();
  });

  it('logout is no-op for unknown user', async () => {
    await expect(manager.logout('nonexistent')).resolves.toBeUndefined();
  });
});
