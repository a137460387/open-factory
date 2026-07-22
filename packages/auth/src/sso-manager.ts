import type { AuthProvider } from './providers.js';
import { OIDCProvider, SAMLProvider } from './providers.js';
import type { SSOProviderConfig, SSOSession } from './types.js';

export class SSOManager {
  private providers = new Map<string, AuthProvider>();
  private sessions = new Map<string, SSOSession>();

  async registerProvider(config: SSOProviderConfig): Promise<void> {
    let provider: AuthProvider;
    if (config.type === 'oidc') {
      provider = new OIDCProvider(config.id);
    } else if (config.type === 'saml') {
      provider = new SAMLProvider(config.id);
    } else {
      throw new Error(`Unsupported SSO provider type: ${config.type}`);
    }

    await provider.initialize(config);
    this.providers.set(config.id, provider);
  }

  getProvider(providerId: string): AuthProvider | undefined {
    return this.providers.get(providerId);
  }

  listProviders(): SSOProviderConfig[] {
    return Array.from(this.providers.values()).map((p) => ({
      id: p.providerId,
      name: p.providerId,
      type: p.providerType,
      enabled: true,
    }));
  }

  async startLogin(providerId: string, state: string): Promise<string> {
    const provider = this.providers.get(providerId);
    if (!provider) throw new Error(`SSO provider not found: ${providerId}`);
    return provider.getLoginUrl(state);
  }

  async handleCallback(
    providerId: string,
    params: Record<string, string>,
  ): Promise<SSOSession> {
    const provider = this.providers.get(providerId);
    if (!provider) throw new Error(`SSO provider not found: ${providerId}`);
    const session = await provider.handleCallback(params);
    this.sessions.set(session.userId, session);
    return session;
  }

  getSession(userId: string): SSOSession | undefined {
    return this.sessions.get(userId);
  }

  async logout(userId: string): Promise<void> {
    const session = this.sessions.get(userId);
    if (!session) return;
    const provider = this.providers.get(session.provider);
    if (provider) {
      await provider.logout(session);
    }
    this.sessions.delete(userId);
  }

  removeProvider(providerId: string): void {
    this.providers.delete(providerId);
  }
}
