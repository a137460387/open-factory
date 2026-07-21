/**
 * Template applicator — applies a template to source media,
 * generates a project file, and optionally renders output.
 */

import type { HeadlessConfig, HeadlessProgress } from './headless-editor-core';
import type { ProjectFileV2 } from '../project/project-types';
import type { Timeline, Track, Clip, MediaAsset } from '../model';

export interface TemplateApplyRequest {
  /** Path to template file (.json) */
  templatePath: string;
  /** Source media files to apply template to */
  mediaFiles: string[];
  /** Output project path */
  outputProjectPath: string;
  /** Whether to also render the result */
  render?: boolean;
  /** Render output path (required if render=true) */
  renderOutputPath?: string;
  /** Progress callback */
  onProgress?: (progress: HeadlessProgress) => void;
}

export interface TemplateApplyResult {
  success: boolean;
  projectPath: string;
  renderResult?: { success: boolean; outputPath: string; error?: string };
  warnings: string[];
  error?: string;
}

export interface TemplateDefinition {
  name: string;
  version: string;
  description: string;
  aspectRatio: { width: number; height: number };
  fps: number;
  /** Timeline structure with placeholder clips */
  timeline: Timeline;
  /** Media slot definitions */
  slots: MediaSlot[];
  /** Default export settings */
  defaultExportSettings?: Record<string, unknown>;
}

export interface MediaSlot {
  id: string;
  type: 'video' | 'audio' | 'image';
  trackIndex: number;
  clipIndex: number;
  description: string;
}

/**
 * Load a template definition from file.
 */
export async function loadTemplate(templatePath: string): Promise<TemplateDefinition> {
  const fs = await import('node:fs/promises');
  const content = await fs.readFile(templatePath, 'utf-8');
  const template = JSON.parse(content) as TemplateDefinition;

  if (!template.name || !template.timeline || !template.slots) {
    throw new Error(`Invalid template file: ${templatePath}`);
  }

  return template;
}

/**
 * Apply a template to source media files, generating a project.
 */
export async function applyTemplate(request: TemplateApplyRequest): Promise<TemplateApplyResult> {
  const warnings: string[] = [];

  request.onProgress?.({ phase: 'loading', percent: 0, message: 'Loading template' });

  let template: TemplateDefinition;
  try {
    template = await loadTemplate(request.templatePath);
  } catch (err) {
    return {
      success: false,
      projectPath: '',
      warnings,
      error: `Failed to load template: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  request.onProgress?.({ phase: 'analyzing', percent: 30, message: 'Mapping media to slots' });

  // Map media files to template slots
  if (request.mediaFiles.length < template.slots.length) {
    warnings.push(
      `Template expects ${template.slots.length} media files but only ${request.mediaFiles.length} provided`,
    );
  }

  // Build project from template
  const project = buildProjectFromTemplate(template, request.mediaFiles);

  request.onProgress?.({ phase: 'analyzing', percent: 60, message: 'Writing project file' });

  // Write project file
  const fs = await import('node:fs/promises');
  await fs.writeFile(request.outputProjectPath, JSON.stringify(project, null, 2), 'utf-8');

  request.onProgress?.({ phase: 'done', percent: 100, message: 'Template applied' });

  const result: TemplateApplyResult = {
    success: true,
    projectPath: request.outputProjectPath,
    warnings,
  };

  // Optionally render
  if (request.render && request.renderOutputPath) {
    request.onProgress?.({ phase: 'rendering', percent: 0, message: 'Starting render' });

    const { headlessRender } = await import('./headless-renderer');
    const renderResult = await headlessRender(
      {
        projectPath: request.outputProjectPath,
        outputPath: request.renderOutputPath,
        onProgress: request.onProgress,
      },
    );

    result.renderResult = {
      success: renderResult.success,
      outputPath: renderResult.outputPath,
      error: renderResult.error,
    };
  }

  return result;
}

/**
 * Build a project file from a template and media files.
 */
function buildProjectFromTemplate(
  template: TemplateDefinition,
  mediaFiles: string[],
): ProjectFileV2 {
  const now = new Date().toISOString();
  const projectId = `template-${Date.now()}`;

  // Create media assets from files
  const assets: MediaAsset[] = mediaFiles.map((path, i) => ({
    id: `media-${i}`,
    name: path.split('/').pop() ?? path.split('\\').pop() ?? `media-${i}`,
    path,
    type: detectMediaType(path),
    duration: 0, // Will be resolved during render
    width: 0,
    height: 0,
  }));

  // Deep clone timeline and replace placeholder clips with real media
  const timeline = JSON.parse(JSON.stringify(template.timeline)) as Timeline;
  replaceTimelineMedia(timeline, assets, template.slots);

  return {
    schemaVersion: 2,
    project: {
      id: projectId,
      name: `Template: ${template.name}`,
      createdAt: now,
      updatedAt: now,
      settings: {
        width: template.aspectRatio.width,
        height: template.aspectRatio.height,
        fps: template.fps,
        timecodeFormat: 'ndf' as const,
      },
      media: assets,
      timeline,
    },
  };
}

/**
 * Detect media type from file extension.
 */
function detectMediaType(path: string): 'video' | 'audio' | 'image' {
  const ext = path.split('.').pop()?.toLowerCase() ?? '';
  const audioExts = ['mp3', 'wav', 'aac', 'flac', 'ogg', 'm4a'];
  const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'];

  if (audioExts.includes(ext)) return 'audio';
  if (imageExts.includes(ext)) return 'image';
  return 'video';
}

/**
 * Replace placeholder media references in timeline with actual media assets.
 */
function replaceTimelineMedia(timeline: Timeline, assets: MediaAsset[], slots: MediaSlot[]): void {
  for (let i = 0; i < slots.length && i < assets.length; i++) {
    const slot = slots[i]!;
    const asset = assets[i]!;

    // Find the target track and clip
    const tracks = (timeline as unknown as { tracks: Track[] }).tracks;
    const track = tracks?.[slot.trackIndex];
    if (!track) continue;

    const clips = (track as unknown as { clips: Clip[] }).clips;
    const clip = clips?.[slot.clipIndex];
    if (!clip) continue;

    // Replace media reference
    (clip as unknown as Record<string, unknown>).mediaId = asset.id;
    (clip as unknown as Record<string, unknown>).mediaPath = asset.path;
  }
}
