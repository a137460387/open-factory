import type { Result, Track, TimelineClip } from './types.js';
import { EventEmitter, ok, err } from './events.js';

/**
 * Timeline operations API
 */
export class TimelineAPI extends EventEmitter {
  private tracks: Track[] = [];
  private clipCounter = 0;

  /**
   * Add a new track
   */
  addTrack(name: string, type: Track['type']): Result<Track> {
    const track: Track = {
      id: `track-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name,
      type,
      clips: [],
    };
    this.tracks.push(track);
    this.emit('timeline:changed', { action: 'addTrack', track });
    return ok(track);
  }

  /**
   * Remove a track
   */
  removeTrack(trackId: string): Result<void> {
    const index = this.tracks.findIndex((t) => t.id === trackId);
    if (index === -1) {
      return err(new Error(`Track ${trackId} not found`));
    }
    this.tracks.splice(index, 1);
    this.emit('timeline:changed', { action: 'removeTrack', trackId });
    return ok(undefined);
  }

  /**
   * Get all tracks
   */
  getTracks(): Track[] {
    return this.tracks.map((t) => ({
      ...t,
      clips: [...t.clips],
    }));
  }

  /**
   * Add a clip to a track
   */
  addClip(
    trackId: string,
    sourceId: string,
    startTime: number,
    endTime: number,
    metadata?: Record<string, unknown>,
  ): Result<TimelineClip> {
    const track = this.tracks.find((t) => t.id === trackId);
    if (!track) {
      return err(new Error(`Track ${trackId} not found`));
    }
    if (endTime <= startTime) {
      return err(new Error('End time must be after start time'));
    }
    const clip: TimelineClip = {
      id: `clip-${++this.clipCounter}-${Date.now()}`,
      trackId,
      startTime,
      endTime,
      sourceId,
      metadata,
    };
    track.clips.push(clip);
    this.emit('timeline:changed', { action: 'addClip', clip });
    return ok(clip);
  }

  /**
   * Remove a clip
   */
  removeClip(trackId: string, clipId: string): Result<void> {
    const track = this.tracks.find((t) => t.id === trackId);
    if (!track) {
      return err(new Error(`Track ${trackId} not found`));
    }
    const index = track.clips.findIndex((c) => c.id === clipId);
    if (index === -1) {
      return err(new Error(`Clip ${clipId} not found`));
    }
    track.clips.splice(index, 1);
    this.emit('timeline:changed', { action: 'removeClip', clipId });
    return ok(undefined);
  }

  /**
   * Move a clip to a new position
   */
  moveClip(
    trackId: string,
    clipId: string,
    newStartTime: number,
  ): Result<TimelineClip> {
    const track = this.tracks.find((t) => t.id === trackId);
    if (!track) {
      return err(new Error(`Track ${trackId} not found`));
    }
    const clip = track.clips.find((c) => c.id === clipId);
    if (!clip) {
      return err(new Error(`Clip ${clipId} not found`));
    }
    const duration = clip.endTime - clip.startTime;
    clip.startTime = newStartTime;
    clip.endTime = newStartTime + duration;
    this.emit('timeline:changed', { action: 'moveClip', clip });
    return ok({ ...clip });
  }

  /**
   * Clear all tracks
   */
  clear(): void {
    this.tracks = [];
    this.emit('timeline:changed', { action: 'clear' });
  }
}
