import { z } from 'zod';

// SSO Provider types
export type SSOProviderType = 'oidc' | 'saml';

export interface SSOProviderConfig {
  id: string;
  name: string;
  type: SSOProviderType;
  enabled: boolean;
  oidc?: OIDCConfig;
  saml?: SAMLConfig;
}

export interface OIDCConfig {
  issuer: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scope?: string[];
}

export interface SAMLConfig {
  entryPoint: string;
  issuer: string;
  cert: string;
  callbackUrl: string;
  identifierFormat?: string;
}

export interface SSOUserProfile {
  id: string;
  email: string;
  displayName: string;
  provider: string;
  providerUserId: string;
  roles?: string[];
  metadata?: Record<string, unknown>;
}

export interface SSOSession {
  userId: string;
  provider: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  profile: SSOUserProfile;
}

// Validation schemas
export const oidcConfigSchema = z.object({
  issuer: z.string().url(),
  clientId: z.string().min(1),
  clientSecret: z.string().min(1),
  redirectUri: z.string().url(),
  scope: z.array(z.string()).optional().default(['openid', 'profile', 'email']),
});

export const samlConfigSchema = z.object({
  entryPoint: z.string().url(),
  issuer: z.string().min(1),
  cert: z.string().min(1),
  callbackUrl: z.string().url(),
  identifierFormat: z.string().optional(),
});

export const ssoProviderConfigSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: z.enum(['oidc', 'saml']),
  enabled: z.boolean().default(true),
  oidc: oidcConfigSchema.optional(),
  saml: samlConfigSchema.optional(),
});
