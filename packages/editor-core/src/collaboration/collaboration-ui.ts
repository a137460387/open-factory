/**
 * Collaboration UI Prototype
 *
 * Implements collaborator cursor display, presence indicators,
 * and a collaboration status panel.
 */

import type { AwarenessState, CollaboratorCursor } from './crdt-integration';

// ─── Collaborator Cursor Component Data ──────────────────────────

export interface CursorDisplayData {
  userId: string;
  displayName: string;
  color: string;
  /** Cursor X position (normalized 0-1 across timeline width) */
  normalizedPosition: number;
  /** Active track index */
  trackIndex: number;
  /** Whether cursor is visible */
  visible: boolean;
}

/**
 * Transform raw awareness state into display-ready cursor data.
 */
export function transformCursorsToDisplay(
  awareness: AwarenessState[],
  timelineDuration: number,
  trackCount: number,
): CursorDisplayData[] {
  return awareness
    .filter((s) => s.isOnline)
    .map((s) => ({
      userId: s.userId,
      displayName: s.displayName,
      color: s.color,
      normalizedPosition: timelineDuration > 0 ? s.cursor.time / timelineDuration : 0,
      trackIndex: s.cursor.trackId ? 0 : -1, // simplified: would look up actual track index
      visible: true,
    }));
}

// ─── Collaboration Status ────────────────────────────────────────

export type CollaborationStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface CollaborationSessionInfo {
  /** Session/room ID */
  sessionId: string;
  /** Project being collaborated on */
  projectId: string;
  /** Current connection status */
  status: CollaborationStatus;
  /** List of connected peers */
  peers: PeerInfo[];
  /** Local user info */
  localUser: UserInfo;
  /** Session start time */
  startedAt: number;
  /** Encryption status */
  encrypted: boolean;
}

export interface PeerInfo {
  userId: string;
  displayName: string;
  color: string;
  isOnline: boolean;
  latencyMs: number;
  lastSeenAt: number;
}

export interface UserInfo {
  userId: string;
  displayName: string;
  color: string;
  isHost: boolean;
}

// ─── Status Panel Data ───────────────────────────────────────────

export interface StatusPanelData {
  session: CollaborationSessionInfo | null;
  collaborators: CollaboratorCursor[];
  /** Total number of edits by each user */
  editCounts: Map<string, number>;
  /** Current sync latency in ms */
  syncLatencyMs: number;
  /** Whether local changes are synced */
  isInSync: boolean;
  /** Number of pending local operations */
  pendingOperations: number;
}

/**
 * Build status panel data from session and awareness state.
 */
export function buildStatusPanelData(
  session: CollaborationSessionInfo | null,
  cursors: CollaboratorCursor[],
  editCounts?: Map<string, number>,
  syncLatencyMs?: number,
  pendingOps?: number,
): StatusPanelData {
  return {
    session,
    collaborators: cursors,
    editCounts: editCounts ?? new Map(),
    syncLatencyMs: syncLatencyMs ?? 0,
    isInSync: (pendingOps ?? 0) === 0,
    pendingOperations: pendingOps ?? 0,
  };
}

// ─── User Colors ─────────────────────────────────────────────────

const COLLABORATOR_COLORS = [
  '#FF6B6B', // red
  '#4ECDC4', // teal
  '#45B7D1', // blue
  '#96CEB4', // sage
  '#FFEAA7', // yellow
  '#DDA0DD', // plum
  '#98D8C8', // mint
  '#F7DC6F', // gold
];

/**
 * Assign a unique color to a collaborator based on their user ID.
 */
export function assignCollaboratorColor(userId: string, takenColors: string[]): string {
  // Simple hash to pick a color
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = ((hash << 5) - hash + userId.charCodeAt(i)) >>> 0;
  }

  // Try preferred color first, then find an untaken one
  const preferred = COLLABORATOR_COLORS[hash % COLLABORATOR_COLORS.length];
  if (!takenColors.includes(preferred)) return preferred;

  for (const color of COLLABORATOR_COLORS) {
    if (!takenColors.includes(color)) return color;
  }

  // All taken, generate a random one
  return `hsl(${hash % 360}, 70%, 60%)`;
}

// ─── Presence Indicator ──────────────────────────────────────────

export interface PresenceIndicator {
  userId: string;
  displayName: string;
  color: string;
  initials: string;
  status: 'active' | 'idle' | 'away';
  tooltip: string;
}

/**
 * Generate presence indicators from awareness state.
 */
export function generatePresenceIndicators(
  awareness: AwarenessState[],
  idleTimeoutMs: number = 60000,
): PresenceIndicator[] {
  const now = Date.now();
  return awareness
    .filter((s) => s.isOnline)
    .map((s) => {
      const isActive = now - s.cursor.time < idleTimeoutMs;
      const initials = s.displayName
        .split(' ')
        .map((w) => w[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);

      return {
        userId: s.userId,
        displayName: s.displayName,
        color: s.color,
        initials,
        status: isActive ? 'active' : 'idle',
        tooltip: `${s.displayName} - ${isActive ? 'editing' : 'idle'}`,
      };
    });
}

// ─── Invitation System ───────────────────────────────────────────

export interface CollaborationInvite {
  /** Unique invite token */
  token: string;
  /** Project ID */
  projectId: string;
  /** Host user ID */
  hostUserId: string;
  /** Invite expiration timestamp */
  expiresAt: number;
  /** Max uses (0 = unlimited) */
  maxUses: number;
  /** Current use count */
  useCount: number;
  /** Permission level */
  permission: 'view' | 'edit';
}

/**
 * Generate a collaboration invite link.
 */
export function generateInviteLink(
  projectId: string,
  hostUserId: string,
  options?: {
    expiresInMs?: number;
    maxUses?: number;
    permission?: 'view' | 'edit';
  },
): CollaborationInvite {
  const token = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return {
    token,
    projectId,
    hostUserId,
    expiresAt: Date.now() + (options?.expiresInMs ?? 3600000), // 1 hour default
    maxUses: options?.maxUses ?? 10,
    useCount: 0,
    permission: options?.permission ?? 'edit',
  };
}

/**
 * Validate an invite link.
 */
export function validateInvite(invite: CollaborationInvite): {
  valid: boolean;
  reason?: string;
} {
  if (Date.now() > invite.expiresAt) {
    return { valid: false, reason: 'Invite has expired' };
  }
  if (invite.maxUses > 0 && invite.useCount >= invite.maxUses) {
    return { valid: false, reason: 'Invite has reached maximum uses' };
  }
  return { valid: true };
}
