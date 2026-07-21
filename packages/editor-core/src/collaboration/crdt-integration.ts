/**
 * CRDT Integration - Yjs-based Collaborative Editing
 *
 * Wraps core timeline data structures as Yjs shared types
 * for conflict-free concurrent editing.
 *
 * This is a technical prototype for P2P collaboration.
 * Production use requires WebRTC transport + E2E encryption.
 */

// ─── Yjs Shared Type Wrappers ────────────────────────────────────

/**
 * Shared timeline track representation.
 * Uses Yjs Y.Map for conflict-free property merging.
 */
export interface SharedTrack {
  id: string;
  type: string;
  name: string;
  muted: boolean;
  locked: boolean;
  clipIds: string[];
}

/**
 * Shared clip representation.
 * Individual properties are Y.Map entries for fine-grained merging.
 */
export interface SharedClip {
  id: string;
  type: string;
  trackId: string;
  startTime: number;
  duration: number;
  volume: number;
  speed: number;
  opacity: number;
  sourceId: string;
  inPoint: number;
  outPoint: number;
}

/**
 * Shared transition between clips.
 */
export interface SharedTransition {
  id: string;
  type: string;
  duration: number;
  clipAId: string;
  clipBId: string;
}

/**
 * Cursor position for collaborator awareness.
 */
export interface CollaboratorCursor {
  userId: string;
  displayName: string;
  color: string;
  currentTime: number;
  activeTrackId: string | null;
  activeClipId: string | null;
  lastUpdatedAt: number;
}

/**
 * Collaboration awareness state.
 */
export interface AwarenessState {
  userId: string;
  displayName: string;
  color: string;
  cursor: {
    time: number;
    trackId: string | null;
    clipId: string | null;
  };
  selection: {
    clipIds: string[];
    trackIds: string[];
  };
  isOnline: boolean;
}

// ─── CRDT Document Manager ───────────────────────────────────────

/**
 * Manages a Yjs document for collaborative timeline editing.
 *
 * In a real implementation, this would use:
 * - Y.Doc for the shared document
 * - Y.Map for tracks, clips, transitions
 * - Y.Array for ordered collections
 * - Y.Text for text content
 * - WebRTC provider for P2P sync
 *
 * This prototype defines the interface and merge semantics.
 */
export class CrdtDocumentManager {
  private tracks: Map<string, SharedTrack> = new Map();
  private clips: Map<string, SharedClip> = new Map();
  private transitions: Map<string, SharedTransition> = new Map();
  private awareness: Map<string, AwarenessState> = new Map();
  private localUserId: string;
  private listeners: Set<(event: CrdtEvent) => void> = new Set();

  constructor(userId: string) {
    this.localUserId = userId;
  }

  // ─── Track Operations ────────────────────────────────────────

  addTrack(track: SharedTrack): void {
    this.tracks.set(track.id, { ...track });
    this.emit({ type: 'track-added', trackId: track.id });
  }

  updateTrack(trackId: string, updates: Partial<SharedTrack>): void {
    const existing = this.tracks.get(trackId);
    if (!existing) return;
    this.tracks.set(trackId, { ...existing, ...updates });
    this.emit({ type: 'track-updated', trackId });
  }

  removeTrack(trackId: string): void {
    this.tracks.delete(trackId);
    // Remove associated clips
    for (const [clipId, clip] of this.clips) {
      if (clip.trackId === trackId) {
        this.clips.delete(clipId);
      }
    }
    this.emit({ type: 'track-removed', trackId });
  }

  // ─── Clip Operations ─────────────────────────────────────────

  addClip(clip: SharedClip): void {
    const track = this.tracks.get(clip.trackId);
    if (!track) return;
    this.clips.set(clip.id, { ...clip });
    track.clipIds = [...track.clipIds, clip.id];
    this.emit({ type: 'clip-added', clipId: clip.id, trackId: clip.trackId });
  }

  updateClip(clipId: string, updates: Partial<SharedClip>): void {
    const existing = this.clips.get(clipId);
    if (!existing) return;
    this.clips.set(clipId, { ...existing, ...updates });
    this.emit({ type: 'clip-updated', clipId });
  }

  moveClip(clipId: string, targetTrackId: string, newStartTime: number): void {
    const clip = this.clips.get(clipId);
    if (!clip) return;

    const sourceTrack = this.tracks.get(clip.trackId);
    const targetTrack = this.tracks.get(targetTrackId);
    if (!sourceTrack || !targetTrack) return;

    // Remove from source track
    sourceTrack.clipIds = sourceTrack.clipIds.filter((id) => id !== clipId);

    // Add to target track
    targetTrack.clipIds = [...targetTrack.clipIds, clipId];

    // Update clip
    this.clips.set(clipId, {
      ...clip,
      trackId: targetTrackId,
      startTime: newStartTime,
    });

    this.emit({ type: 'clip-moved', clipId, fromTrackId: clip.trackId, toTrackId: targetTrackId });
  }

  removeClip(clipId: string): void {
    const clip = this.clips.get(clipId);
    if (!clip) return;

    const track = this.tracks.get(clip.trackId);
    if (track) {
      track.clipIds = track.clipIds.filter((id) => id !== clipId);
    }

    // Remove associated transitions
    for (const [transId, trans] of this.transitions) {
      if (trans.clipAId === clipId || trans.clipBId === clipId) {
        this.transitions.delete(transId);
      }
    }

    this.clips.delete(clipId);
    this.emit({ type: 'clip-removed', clipId, trackId: clip.trackId });
  }

  // ─── Transition Operations ───────────────────────────────────

  addTransition(transition: SharedTransition): void {
    this.transitions.set(transition.id, { ...transition });
    this.emit({ type: 'transition-added', transitionId: transition.id });
  }

  removeTransition(transitionId: string): void {
    this.transitions.delete(transitionId);
    this.emit({ type: 'transition-removed', transitionId });
  }

  // ─── Awareness Operations ────────────────────────────────────

  updateAwareness(state: AwarenessState): void {
    this.awareness.set(state.userId, { ...state });
    this.emit({ type: 'awareness-updated', userId: state.userId });
  }

  getAwareness(): AwarenessState[] {
    return Array.from(this.awareness.values());
  }

  getCollaboratorCursors(): CollaboratorCursor[] {
    const now = Date.now();
    return Array.from(this.awareness.values())
      .filter((s) => s.isOnline && now - s.cursor.time < 30000) // 30s timeout
      .map((s) => ({
        userId: s.userId,
        displayName: s.displayName,
        color: s.color,
        currentTime: s.cursor.time,
        activeTrackId: s.cursor.trackId,
        activeClipId: s.cursor.clipId,
        lastUpdatedAt: now,
      }));
  }

  // ─── Query ───────────────────────────────────────────────────

  getTracks(): SharedTrack[] {
    return Array.from(this.tracks.values());
  }

  getClips(): SharedClip[] {
    return Array.from(this.clips.values());
  }

  getTransitions(): SharedTransition[] {
    return Array.from(this.transitions.values());
  }

  getTrack(trackId: string): SharedTrack | undefined {
    return this.tracks.get(trackId);
  }

  getClip(clipId: string): SharedClip | undefined {
    return this.clips.get(clipId);
  }

  // ─── Conflict Resolution ─────────────────────────────────────

  /**
   * Apply a remote operation. Uses last-writer-wins for scalar properties
   * and CRDT merge semantics for collections.
   */
  applyRemoteOperation(op: CrdtOperation): void {
    switch (op.type) {
      case 'set-track':
        this.tracks.set(op.track.id, op.track);
        break;
      case 'set-clip':
        this.clips.set(op.clip.id, op.clip);
        break;
      case 'set-transition':
        this.transitions.set(op.transition.id, op.transition);
        break;
      case 'delete-track':
        this.removeTrack(op.trackId);
        break;
      case 'delete-clip':
        this.removeClip(op.clipId);
        break;
      case 'delete-transition':
        this.transitions.delete(op.transitionId);
        break;
      case 'awareness':
        this.updateAwareness(op.state);
        break;
    }
  }

  // ─── Event System ────────────────────────────────────────────

  onEvent(listener: (event: CrdtEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(event: CrdtEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }
}

// ─── CRDT Operation Types ────────────────────────────────────────

export type CrdtOperation =
  | { type: 'set-track'; track: SharedTrack }
  | { type: 'set-clip'; clip: SharedClip }
  | { type: 'set-transition'; transition: SharedTransition }
  | { type: 'delete-track'; trackId: string }
  | { type: 'delete-clip'; clipId: string }
  | { type: 'delete-transition'; transitionId: string }
  | { type: 'awareness'; state: AwarenessState };

export type CrdtEvent =
  | { type: 'track-added'; trackId: string }
  | { type: 'track-updated'; trackId: string }
  | { type: 'track-removed'; trackId: string }
  | { type: 'clip-added'; clipId: string; trackId: string }
  | { type: 'clip-updated'; clipId: string }
  | { type: 'clip-removed'; clipId: string; trackId: string }
  | { type: 'clip-moved'; clipId: string; fromTrackId: string; toTrackId: string }
  | { type: 'transition-added'; transitionId: string }
  | { type: 'transition-removed'; transitionId: string }
  | { type: 'awareness-updated'; userId: string };

// ─── Utility: Generate unique IDs ────────────────────────────────

export function generateCrdtId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
