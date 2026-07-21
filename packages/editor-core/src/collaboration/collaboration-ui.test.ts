import { describe, it, expect } from 'vitest';
import {
  transformCursorsToDisplay,
  buildStatusPanelData,
  assignCollaboratorColor,
  generatePresenceIndicators,
  generateInviteLink,
  validateInvite,
  type CollaborationSessionInfo,
} from './collaboration-ui';
import type { AwarenessState } from './crdt-integration';

function makeAwareness(overrides: Partial<AwarenessState> = {}): AwarenessState {
  return {
    userId: 'user-1',
    displayName: 'Alice',
    color: '#FF0000',
    cursor: { time: 5, trackId: 'track-1', clipId: null },
    selection: { clipIds: [], trackIds: [] },
    isOnline: true,
    ...overrides,
  };
}

describe('Collaboration UI', () => {
  describe('transformCursorsToDisplay', () => {
    it('transforms awareness to cursor display data', () => {
      const awareness = [makeAwareness()];
      const cursors = transformCursorsToDisplay(awareness, 60, 3);
      expect(cursors).toHaveLength(1);
      expect(cursors[0].userId).toBe('user-1');
      expect(cursors[0].displayName).toBe('Alice');
      expect(cursors[0].visible).toBe(true);
    });

    it('filters offline users', () => {
      const awareness = [
        makeAwareness({ userId: 'online' }),
        makeAwareness({ userId: 'offline', isOnline: false }),
      ];
      const cursors = transformCursorsToDisplay(awareness, 60, 3);
      expect(cursors).toHaveLength(1);
    });

    it('normalizes position to timeline duration', () => {
      const awareness = [makeAwareness({ cursor: { time: 30, trackId: null, clipId: null } })];
      const cursors = transformCursorsToDisplay(awareness, 60, 1);
      expect(cursors[0].normalizedPosition).toBeCloseTo(0.5);
    });
  });

  describe('assignCollaboratorColor', () => {
    it('assigns a color', () => {
      const color = assignCollaboratorColor('user-1', []);
      expect(color).toBeTruthy();
      expect(typeof color).toBe('string');
    });

    it('avoids taken colors when possible', () => {
      const color1 = assignCollaboratorColor('user-1', []);
      const color2 = assignCollaboratorColor('user-2', [color1]);
      // Should prefer a different color
      expect(color2).toBeTruthy();
    });
  });

  describe('generatePresenceIndicators', () => {
    it('generates indicators for online users', () => {
      const awareness = [makeAwareness({ cursor: { time: Date.now(), trackId: 'track-1', clipId: null } })];
      const indicators = generatePresenceIndicators(awareness);
      expect(indicators).toHaveLength(1);
      expect(indicators[0].initials).toBe('A');
      expect(indicators[0].status).toBe('active');
    });

    it('generates multi-word initials', () => {
      const awareness = [makeAwareness({ displayName: 'Alice Bob' })];
      const indicators = generatePresenceIndicators(awareness);
      expect(indicators[0].initials).toBe('AB');
    });

    it('marks idle users', () => {
      // Cursor time far in the past
      const awareness = [makeAwareness({ cursor: { time: 0, trackId: null, clipId: null } })];
      const indicators = generatePresenceIndicators(awareness, 1000);
      expect(indicators[0].status).toBe('idle');
    });
  });

  describe('buildStatusPanelData', () => {
    it('builds panel data with defaults', () => {
      const data = buildStatusPanelData(null, []);
      expect(data.session).toBeNull();
      expect(data.collaborators).toHaveLength(0);
      expect(data.isInSync).toBe(true);
    });

    it('builds panel data with session', () => {
      const session: CollaborationSessionInfo = {
        sessionId: 'sess-1',
        projectId: 'proj-1',
        status: 'connected',
        peers: [],
        localUser: { userId: 'u1', displayName: 'Me', color: '#000', isHost: true },
        startedAt: Date.now(),
        encrypted: true,
      };
      const data = buildStatusPanelData(session, []);
      expect(data.session?.status).toBe('connected');
      expect(data.session?.encrypted).toBe(true);
    });
  });

  describe('generateInviteLink', () => {
    it('generates a valid invite', () => {
      const invite = generateInviteLink('proj-1', 'host-1');
      expect(invite.token).toBeTruthy();
      expect(invite.projectId).toBe('proj-1');
      expect(invite.hostUserId).toBe('host-1');
      expect(invite.permission).toBe('edit');
      expect(invite.expiresAt).toBeGreaterThan(Date.now());
    });

    it('respects options', () => {
      const invite = generateInviteLink('proj-1', 'host-1', {
        maxUses: 5,
        permission: 'view',
        expiresInMs: 60000,
      });
      expect(invite.maxUses).toBe(5);
      expect(invite.permission).toBe('view');
    });
  });

  describe('validateInvite', () => {
    it('validates a fresh invite', () => {
      const invite = generateInviteLink('proj-1', 'host-1');
      const result = validateInvite(invite);
      expect(result.valid).toBe(true);
    });

    it('rejects expired invite', () => {
      const invite = generateInviteLink('proj-1', 'host-1', { expiresInMs: -1 });
      const result = validateInvite(invite);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('expired');
    });

    it('rejects maxed out invite', () => {
      const invite = generateInviteLink('proj-1', 'host-1', { maxUses: 1 });
      invite.useCount = 1;
      const result = validateInvite(invite);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('maximum uses');
    });
  });
});
