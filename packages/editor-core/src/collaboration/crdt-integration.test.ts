import { describe, it, expect, beforeEach } from 'vitest';
import {
  CrdtDocumentManager,
  generateCrdtId,
  type SharedTrack,
  type SharedClip,
  type SharedTransition,
  type AwarenessState,
  type CrdtEvent,
} from './crdt-integration';

function makeTrack(id: string = 'track-1'): SharedTrack {
  return { id, type: 'video', name: 'Main', muted: false, locked: false, clipIds: [] };
}

function makeClip(id: string = 'clip-1', trackId: string = 'track-1'): SharedClip {
  return {
    id,
    type: 'video',
    trackId,
    startTime: 0,
    duration: 5,
    volume: 1,
    speed: 1,
    opacity: 1,
    sourceId: 'media-1',
    inPoint: 0,
    outPoint: 5,
  };
}

function makeTransition(id: string = 'trans-1'): SharedTransition {
  return { id, type: 'dissolve', duration: 0.5, clipAId: 'clip-1', clipBId: 'clip-2' };
}

function makeAwareness(userId: string = 'user-1'): AwarenessState {
  return {
    userId,
    displayName: 'User',
    color: '#FF0000',
    cursor: { time: 5, trackId: 'track-1', clipId: null },
    selection: { clipIds: [], trackIds: [] },
    isOnline: true,
  };
}

describe('CRDT Integration', () => {
  describe('CrdtDocumentManager', () => {
    let doc: CrdtDocumentManager;

    beforeEach(() => {
      doc = new CrdtDocumentManager('local-user');
    });

    // ─── Track Operations ──────────────────────────────────────

    it('adds and retrieves tracks', () => {
      doc.addTrack(makeTrack());
      expect(doc.getTracks()).toHaveLength(1);
      expect(doc.getTrack('track-1')?.name).toBe('Main');
    });

    it('updates track properties', () => {
      doc.addTrack(makeTrack());
      doc.updateTrack('track-1', { name: 'Renamed', muted: true });
      const track = doc.getTrack('track-1');
      expect(track?.name).toBe('Renamed');
      expect(track?.muted).toBe(true);
    });

    it('removes track and associated clips', () => {
      doc.addTrack(makeTrack());
      doc.addClip(makeClip());
      doc.removeTrack('track-1');
      expect(doc.getTracks()).toHaveLength(0);
      expect(doc.getClips()).toHaveLength(0);
    });

    it('emits track events', () => {
      const events: CrdtEvent[] = [];
      doc.onEvent((e) => events.push(e));

      doc.addTrack(makeTrack());
      doc.updateTrack('track-1', { name: 'Updated' });
      doc.removeTrack('track-1');

      expect(events.map((e) => e.type)).toEqual([
        'track-added',
        'track-updated',
        'track-removed',
      ]);
    });

    // ─── Clip Operations ───────────────────────────────────────

    it('adds clips to track', () => {
      doc.addTrack(makeTrack());
      doc.addClip(makeClip());
      expect(doc.getClips()).toHaveLength(1);
      expect(doc.getTrack('track-1')?.clipIds).toContain('clip-1');
    });

    it('updates clip properties', () => {
      doc.addTrack(makeTrack());
      doc.addClip(makeClip());
      doc.updateClip('clip-1', { duration: 10, volume: 0.5 });
      const clip = doc.getClip('clip-1');
      expect(clip?.duration).toBe(10);
      expect(clip?.volume).toBe(0.5);
    });

    it('moves clip between tracks', () => {
      doc.addTrack(makeTrack('track-1'));
      doc.addTrack(makeTrack('track-2'));
      doc.addClip(makeClip('clip-1', 'track-1'));

      doc.moveClip('clip-1', 'track-2', 10);

      expect(doc.getTrack('track-1')?.clipIds).not.toContain('clip-1');
      expect(doc.getTrack('track-2')?.clipIds).toContain('clip-1');
      expect(doc.getClip('clip-1')?.trackId).toBe('track-2');
      expect(doc.getClip('clip-1')?.startTime).toBe(10);
    });

    it('removes clip and associated transitions', () => {
      doc.addTrack(makeTrack());
      doc.addClip(makeClip('clip-1'));
      doc.addClip(makeClip('clip-2'));
      doc.addTransition(makeTransition());

      doc.removeClip('clip-1');

      expect(doc.getClips()).toHaveLength(1);
      expect(doc.getTransitions()).toHaveLength(0);
    });

    // ─── Transition Operations ─────────────────────────────────

    it('adds and removes transitions', () => {
      doc.addTrack(makeTrack());
      doc.addClip(makeClip('clip-1'));
      doc.addClip(makeClip('clip-2'));
      doc.addTransition(makeTransition());

      expect(doc.getTransitions()).toHaveLength(1);

      doc.removeTransition('trans-1');
      expect(doc.getTransitions()).toHaveLength(0);
    });

    // ─── Awareness ─────────────────────────────────────────────

    it('updates and retrieves awareness', () => {
      doc.updateAwareness(makeAwareness('user-1'));
      doc.updateAwareness(makeAwareness('user-2'));

      const awareness = doc.getAwareness();
      expect(awareness).toHaveLength(2);
    });

    it('gets collaborator cursors for online users', () => {
      doc.updateAwareness({ ...makeAwareness('user-1'), cursor: { time: Date.now(), trackId: 'track-1', clipId: null } });
      doc.updateAwareness({ ...makeAwareness('user-2'), isOnline: false });

      const cursors = doc.getCollaboratorCursors();
      expect(cursors).toHaveLength(1);
      expect(cursors[0].userId).toBe('user-1');
    });

    // ─── Remote Operations ─────────────────────────────────────

    it('applies remote track operation', () => {
      doc.applyRemoteOperation({ type: 'set-track', track: makeTrack() });
      expect(doc.getTracks()).toHaveLength(1);
    });

    it('applies remote clip operation', () => {
      doc.addTrack(makeTrack());
      doc.applyRemoteOperation({ type: 'set-clip', clip: makeClip() });
      expect(doc.getClips()).toHaveLength(1);
    });

    it('applies remote delete operations', () => {
      doc.addTrack(makeTrack());
      doc.addClip(makeClip());
      doc.applyRemoteOperation({ type: 'delete-clip', clipId: 'clip-1' });
      expect(doc.getClips()).toHaveLength(0);
    });
  });

  describe('generateCrdtId', () => {
    it('generates unique IDs', () => {
      const id1 = generateCrdtId();
      const id2 = generateCrdtId();
      expect(id1).not.toBe(id2);
    });

    it('returns string', () => {
      expect(typeof generateCrdtId()).toBe('string');
    });
  });
});
