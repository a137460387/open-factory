/**
 * Plugin Editor API
 *
 * Provides plugins with controlled access to the editor's project,
 * timeline, clips, and rendering capabilities.
 */

import type { Clip, Project } from '@open-factory/editor-core';

// ─── Editor API Types ────────────────────────────────────────────

export interface PluginEditorAPI {
  /** Get the current project (read-only snapshot) */
  getProject(): Promise<Project>;
  /** Update the current project */
  updateProject(project: Project): Promise<void>;
  /** Get selected clips */
  getSelectedClips(): Promise<Clip[]>;
  /** Select clips by ID */
  selectClips(clipIds: string[]): Promise<void>;
  /** Add a clip to the timeline */
  addClip(clip: Omit<Clip, 'id'>): Promise<Clip>;
  /** Remove a clip from the timeline */
  removeClip(clipId: string): Promise<void>;
  /** Update a clip's properties */
  updateClip(clipId: string, updates: Partial<Clip>): Promise<void>;
  /** Get timeline duration in seconds */
  getTimelineDuration(): Promise<number>;
  /** Get current playback position in seconds */
  getPlaybackPosition(): Promise<number>;
  /** Seek to a specific position */
  seekTo(positionSeconds: number): Promise<void>;
}

// ─── Editor API Implementation ────────────────────────────────────────────

export class PluginEditorAPIImpl implements PluginEditorAPI {
  private project: Project | null = null;
  private selectedClipIds: string[] = [];
  private playbackPosition = 0;

  setProject(project: Project): void {
    this.project = project;
  }

  async getProject(): Promise<Project> {
    if (!this.project) throw new Error('No project loaded');
    return structuredClone(this.project);
  }

  async updateProject(project: Project): Promise<void> {
    this.project = structuredClone(project);
  }

  async getSelectedClips(): Promise<Clip[]> {
    if (!this.project) return [];
    const project = this.project as unknown as Record<string, unknown>;
    return project.clips
      ? (project.clips as Clip[]).filter((c) =>
          this.selectedClipIds.includes(c.id),
        )
      : [];
  }

  async selectClips(clipIds: string[]): Promise<void> {
    this.selectedClipIds = [...clipIds];
  }

  async addClip(clip: Omit<Clip, 'id'>): Promise<Clip> {
    const newClip = { ...clip, id: `clip-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` } as Clip;
    return newClip;
  }

  async removeClip(clipId: string): Promise<void> {
    this.selectedClipIds = this.selectedClipIds.filter((id) => id !== clipId);
  }

  async updateClip(clipId: string, _updates: Partial<Clip>): Promise<void> {
    void clipId;
    void _updates;
    // Implementation would update the clip in the project
  }

  async getTimelineDuration(): Promise<number> {
    return 0;
  }

  async getPlaybackPosition(): Promise<number> {
    return this.playbackPosition;
  }

  async seekTo(positionSeconds: number): Promise<void> {
    this.playbackPosition = Math.max(0, positionSeconds);
  }
}
