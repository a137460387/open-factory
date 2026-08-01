/**
 * Team management module
 * Provides team creation, member management, role-based access control (RBAC), and project sharing
 * Follows local-first principle, all data stored locally
 *
 * This file is the public entry point. Implementation split into:
 * - types.ts: type definitions, constants, and permission helpers
 * - team-manager-base.ts: TeamManagerBase class (state management, team CRUD)
 * - team-manager-members.ts: TeamManagerB class (member & invitation management)
 * - team-manager.ts: TeamManager class (project sharing, events, factory & serialization)
 */

export * from './types';
export * from './team-manager';
