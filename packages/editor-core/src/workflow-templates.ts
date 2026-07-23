/**
 * Workflow Template Library - Pre-built workflow templates
 *
 * Provides a collection of pre-built workflow templates for common
 * video editing and AI processing tasks.
 */

import type {
  WorkflowTemplate,
  WorkflowGraph,
  WorkflowNode,
  NodeConnection,
} from './node-editor-types';

// ─── Built-in Templates ────────────────────────────────────────────────────

const BUILTIN_TEMPLATES: WorkflowTemplate[] = [
  {
    id: 'highlight-to-subtitle',
    name: 'Highlight Detection + Auto Subtitle',
    description: 'Detect video highlights and automatically generate subtitles for highlight segments',
    category: 'AI Processing',
    tags: ['highlight', 'subtitle', 'ai', 'auto'],
    usageCount: 0,
    graph: {
      name: 'Highlight + Subtitle Workflow',
      description: 'Detect highlights then generate subtitles',
      version: '1.0.0',
      viewport: { x: 0, y: 0, zoom: 1 },
      tags: ['ai', 'subtitle'],
      nodes: [
        {
          id: 'input-1',
          type: 'input.timeline',
          position: { x: 50, y: 100 },
          config: {},
          enabled: true,
        },
        {
          id: 'highlight-1',
          type: 'ai.highlight-detection',
          position: { x: 300, y: 50 },
          config: { sensitivity: 0.7, minDuration: 2 },
          enabled: true,
        },
        {
          id: 'trim-1',
          type: 'ai.smart-trim',
          position: { x: 550, y: 50 },
          config: { aggressiveness: 'medium' },
          enabled: true,
        },
        {
          id: 'subtitle-1',
          type: 'ai.auto-subtitle',
          position: { x: 800, y: 50 },
          config: { language: 'auto', maxCharsPerLine: 42 },
          enabled: true,
        },
        {
          id: 'output-1',
          type: 'output.timeline',
          position: { x: 1050, y: 100 },
          config: { trackName: 'AI Highlights', autoAlign: true },
          enabled: true,
        },
      ],
      connections: [
        { id: 'conn-1', sourceNodeId: 'input-1', sourcePortId: 'clips', targetNodeId: 'highlight-1', targetPortId: 'video' },
        { id: 'conn-2', sourceNodeId: 'input-1', sourcePortId: 'clips', targetNodeId: 'trim-1', targetPortId: 'video' },
        { id: 'conn-3', sourceNodeId: 'highlight-1', sourcePortId: 'highlights', targetNodeId: 'trim-1', targetPortId: 'highlights' },
        { id: 'conn-4', sourceNodeId: 'trim-1', sourcePortId: 'trimmed', targetNodeId: 'subtitle-1', targetPortId: 'audio' },
        { id: 'conn-5', sourceNodeId: 'trim-1', sourcePortId: 'trimmed', targetNodeId: 'output-1', targetPortId: 'video' },
        { id: 'conn-6', sourceNodeId: 'subtitle-1', sourcePortId: 'subtitles', targetNodeId: 'output-1', targetPortId: 'subtitles' },
      ],
    },
  },
  {
    id: 'auto-color-grade',
    name: 'Auto Color Grading',
    description: 'Apply AI-powered color grading to video clips',
    category: 'Color',
    tags: ['color', 'grading', 'ai', 'cinematic'],
    usageCount: 0,
    graph: {
      name: 'Auto Color Grading',
      description: 'AI-powered cinematic color grading',
      version: '1.0.0',
      viewport: { x: 0, y: 0, zoom: 1 },
      tags: ['color', 'ai'],
      nodes: [
        {
          id: 'input-1',
          type: 'input.video',
          position: { x: 50, y: 100 },
          config: {},
          enabled: true,
        },
        {
          id: 'color-1',
          type: 'ai.color-grading',
          position: { x: 300, y: 100 },
          config: { style: 'cinematic', intensity: 0.8 },
          enabled: true,
        },
        {
          id: 'output-1',
          type: 'output.timeline',
          position: { x: 550, y: 100 },
          config: { trackName: 'Color Graded', autoAlign: true },
          enabled: true,
        },
      ],
      connections: [
        { id: 'conn-1', sourceNodeId: 'input-1', sourcePortId: 'video', targetNodeId: 'color-1', targetPortId: 'video' },
        { id: 'conn-2', sourceNodeId: 'color-1', sourcePortId: 'graded', targetNodeId: 'output-1', targetPortId: 'video' },
      ],
    },
  },
  {
    id: 'audio-cleanup',
    name: 'Audio Cleanup Pipeline',
    description: 'Enhance audio quality with noise reduction and normalization',
    category: 'Audio',
    tags: ['audio', 'enhance', 'denoise', 'normalize'],
    usageCount: 0,
    graph: {
      name: 'Audio Cleanup',
      description: 'Clean and enhance audio',
      version: '1.0.0',
      viewport: { x: 0, y: 0, zoom: 1 },
      tags: ['audio'],
      nodes: [
        {
          id: 'input-1',
          type: 'input.audio',
          position: { x: 50, y: 100 },
          config: {},
          enabled: true,
        },
        {
          id: 'enhance-1',
          type: 'ai.audio-enhance',
          position: { x: 300, y: 100 },
          config: { denoise: true, normalize: true, targetLoudness: -14 },
          enabled: true,
        },
        {
          id: 'output-1',
          type: 'output.timeline',
          position: { x: 550, y: 100 },
          config: { trackName: 'Enhanced Audio', autoAlign: true },
          enabled: true,
        },
      ],
      connections: [
        { id: 'conn-1', sourceNodeId: 'input-1', sourcePortId: 'audio', targetNodeId: 'enhance-1', targetPortId: 'audio' },
        { id: 'conn-2', sourceNodeId: 'enhance-1', sourcePortId: 'enhanced', targetNodeId: 'output-1', targetPortId: 'audio' },
      ],
    },
  },
  {
    id: 'smart-trim-export',
    name: 'Smart Trim + Export',
    description: 'AI-powered smart trimming with direct export to file',
    category: 'Export',
    tags: ['trim', 'export', 'ai', 'smart'],
    usageCount: 0,
    graph: {
      name: 'Smart Trim Export',
      description: 'Trim and export in one workflow',
      version: '1.0.0',
      viewport: { x: 0, y: 0, zoom: 1 },
      tags: ['export'],
      nodes: [
        {
          id: 'input-1',
          type: 'input.timeline',
          position: { x: 50, y: 100 },
          config: {},
          enabled: true,
        },
        {
          id: 'trim-1',
          type: 'ai.smart-trim',
          position: { x: 300, y: 100 },
          config: { aggressiveness: 'medium', keepPace: true },
          enabled: true,
        },
        {
          id: 'export-1',
          type: 'output.export',
          position: { x: 550, y: 100 },
          config: { format: 'mp4', quality: 'high', outputPath: '' },
          enabled: true,
        },
      ],
      connections: [
        { id: 'conn-1', sourceNodeId: 'input-1', sourcePortId: 'clips', targetNodeId: 'trim-1', targetPortId: 'video' },
        { id: 'conn-2', sourceNodeId: 'trim-1', sourcePortId: 'trimmed', targetNodeId: 'export-1', targetPortId: 'video' },
      ],
    },
  },
  {
    id: 'scene-detect-highlights',
    name: 'Scene Detection + Highlights',
    description: 'Detect scene changes and identify highlight moments',
    category: 'AI Processing',
    tags: ['scene', 'highlight', 'detection', 'ai'],
    usageCount: 0,
    graph: {
      name: 'Scene + Highlights',
      description: 'Detect scenes and highlights',
      version: '1.0.0',
      viewport: { x: 0, y: 0, zoom: 1 },
      tags: ['ai'],
      nodes: [
        {
          id: 'input-1',
          type: 'input.video',
          position: { x: 50, y: 100 },
          config: {},
          enabled: true,
        },
        {
          id: 'scene-1',
          type: 'ai.scene-detection',
          position: { x: 300, y: 50 },
          config: { threshold: 0.3, minSceneLength: 0.5 },
          enabled: true,
        },
        {
          id: 'highlight-1',
          type: 'ai.highlight-detection',
          position: { x: 300, y: 200 },
          config: { sensitivity: 0.7, minDuration: 1 },
          enabled: true,
        },
        {
          id: 'merge-1',
          type: 'control.merge',
          position: { x: 550, y: 100 },
          config: {},
          enabled: true,
        },
        {
          id: 'output-1',
          type: 'output.timeline',
          position: { x: 800, y: 100 },
          config: { trackName: 'Analysis Results', autoAlign: true },
          enabled: true,
        },
      ],
      connections: [
        { id: 'conn-1', sourceNodeId: 'input-1', sourcePortId: 'video', targetNodeId: 'scene-1', targetPortId: 'video' },
        { id: 'conn-2', sourceNodeId: 'input-1', sourcePortId: 'video', targetNodeId: 'highlight-1', targetPortId: 'video' },
        { id: 'conn-3', sourceNodeId: 'scene-1', sourcePortId: 'scenes', targetNodeId: 'merge-1', targetPortId: 'input1' },
        { id: 'conn-4', sourceNodeId: 'highlight-1', sourcePortId: 'highlights', targetNodeId: 'merge-1', targetPortId: 'input2' },
        { id: 'conn-5', sourceNodeId: 'merge-1', sourcePortId: 'output', targetNodeId: 'output-1', targetPortId: 'video' },
      ],
    },
  },
  {
    id: 'conditional-export',
    name: 'Conditional Export',
    description: 'Export video with conditional quality settings based on duration',
    category: 'Export',
    tags: ['export', 'conditional', 'quality'],
    usageCount: 0,
    graph: {
      name: 'Conditional Export',
      description: 'Export with conditional quality',
      version: '1.0.0',
      viewport: { x: 0, y: 0, zoom: 1 },
      tags: ['export'],
      nodes: [
        {
          id: 'input-1',
          type: 'input.video',
          position: { x: 50, y: 100 },
          config: {},
          enabled: true,
        },
        {
          id: 'if-1',
          type: 'control.if',
          position: { x: 300, y: 100 },
          config: {
            condition: {
              type: 'greater',
              left: 'inputs.duration',
              right: 300,
            },
          },
          enabled: true,
        },
        {
          id: 'export-hq',
          type: 'output.export',
          position: { x: 550, y: 50 },
          config: { format: 'mp4', quality: 'high', outputPath: '' },
          enabled: true,
        },
        {
          id: 'export-lq',
          type: 'output.export',
          position: { x: 550, y: 200 },
          config: { format: 'mp4', quality: 'medium', outputPath: '' },
          enabled: true,
        },
      ],
      connections: [
        { id: 'conn-1', sourceNodeId: 'input-1', sourcePortId: 'video', targetNodeId: 'if-1', targetPortId: 'input' },
        { id: 'conn-2', sourceNodeId: 'if-1', sourcePortId: 'true', targetNodeId: 'export-hq', targetPortId: 'video' },
        { id: 'conn-3', sourceNodeId: 'if-1', sourcePortId: 'false', targetNodeId: 'export-lq', targetPortId: 'video' },
      ],
    },
  },
];

// ─── Template Library ──────────────────────────────────────────────────────

const STORAGE_KEY = 'open-factory-workflow-templates';

/**
 * Workflow template library manager
 */
export class WorkflowTemplateLibrary {
  private templates: WorkflowTemplate[] = [];
  private customTemplates: WorkflowTemplate[] = [];

  constructor() {
    this.templates = [...BUILTIN_TEMPLATES];
    this.customTemplates = this.loadCustomTemplates();
  }

  // ─── Template Management ─────────────────────────────────────────────────

  /** Get all templates (built-in + custom) */
  getAllTemplates(): WorkflowTemplate[] {
    return [...this.templates, ...this.customTemplates];
  }

  /** Get template by ID */
  getTemplate(id: string): WorkflowTemplate | undefined {
    return this.getAllTemplates().find(t => t.id === id);
  }

  /** Get templates by category */
  getTemplatesByCategory(category: string): WorkflowTemplate[] {
    return this.getAllTemplates().filter(t => t.category === category);
  }

  /** Get all categories */
  getCategories(): string[] {
    const categories = new Set(this.getAllTemplates().map(t => t.category));
    return Array.from(categories).sort();
  }

  /** Search templates */
  searchTemplates(query: string): WorkflowTemplate[] {
    const lowerQuery = query.toLowerCase();
    return this.getAllTemplates().filter(
      t =>
        t.name.toLowerCase().includes(lowerQuery) ||
        t.description.toLowerCase().includes(lowerQuery) ||
        t.tags.some(tag => tag.toLowerCase().includes(lowerQuery)),
    );
  }

  /** Get popular templates */
  getPopularTemplates(limit: number = 5): WorkflowTemplate[] {
    return [...this.getAllTemplates()]
      .sort((a, b) => b.usageCount - a.usageCount)
      .slice(0, limit);
  }

  /** Get recent templates */
  getRecentTemplates(limit: number = 5): WorkflowTemplate[] {
    return this.getAllTemplates().slice(0, limit);
  }

  // ─── Custom Templates ────────────────────────────────────────────────────

  /** Save a workflow as a custom template */
  saveTemplate(
    graph: WorkflowGraph,
    name: string,
    description: string,
    category: string,
    tags: string[] = [],
  ): WorkflowTemplate {
    const template: WorkflowTemplate = {
      id: `custom_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      name,
      description,
      category,
      tags,
      usageCount: 0,
      graph: {
        name: graph.name,
        description: graph.description,
        version: graph.version,
        viewport: graph.viewport,
        tags: graph.tags,
        nodes: graph.nodes,
        connections: graph.connections,
      },
    };

    this.customTemplates.push(template);
    this.persistCustomTemplates();
    return template;
  }

  /** Update a custom template */
  updateTemplate(
    id: string,
    updates: Partial<Pick<WorkflowTemplate, 'name' | 'description' | 'category' | 'tags'>>,
  ): boolean {
    const template = this.customTemplates.find(t => t.id === id);
    if (!template) return false;

    Object.assign(template, updates);
    this.persistCustomTemplates();
    return true;
  }

  /** Delete a custom template */
  deleteTemplate(id: string): boolean {
    const initialLength = this.customTemplates.length;
    this.customTemplates = this.customTemplates.filter(t => t.id !== id);

    if (this.customTemplates.length < initialLength) {
      this.persistCustomTemplates();
      return true;
    }
    return false;
  }

  /** Increment usage count */
  incrementUsage(id: string): void {
    const template = this.getTemplate(id);
    if (template) {
      template.usageCount++;
      if (this.customTemplates.includes(template)) {
        this.persistCustomTemplates();
      }
    }
  }

  // ─── Import/Export ───────────────────────────────────────────────────────

  /** Export template to JSON */
  exportTemplate(id: string): string | null {
    const template = this.getTemplate(id);
    if (!template) return null;
    return JSON.stringify(template, null, 2);
  }

  /** Import template from JSON */
  importTemplate(json: string): WorkflowTemplate | null {
    try {
      const parsed = JSON.parse(json);

      if (!this.isValidTemplate(parsed)) {
        return null;
      }

      const template: WorkflowTemplate = {
        ...parsed,
        id: `imported_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        usageCount: 0,
      };

      this.customTemplates.push(template);
      this.persistCustomTemplates();
      return template;
    } catch {
      return null;
    }
  }

  // ─── Validation ──────────────────────────────────────────────────────────

  private isValidTemplate(obj: unknown): obj is WorkflowTemplate {
    if (typeof obj !== 'object' || obj === null) return false;
    const template = obj as Record<string, unknown>;
    return (
      typeof template.name === 'string' &&
      typeof template.description === 'string' &&
      typeof template.category === 'string' &&
      template.graph !== undefined &&
      typeof template.graph === 'object'
    );
  }

  // ─── Persistence ─────────────────────────────────────────────────────────

  private loadCustomTemplates(): WorkflowTemplate[] {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            return parsed.filter(t => this.isValidTemplate(t));
          }
        }
      }
    } catch {
      // Ignore load errors
    }
    return [];
  }

  private persistCustomTemplates(): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.customTemplates));
      }
    } catch {
      // Ignore save errors
    }
  }
}

/**
 * Create a workflow template library
 */
export function createWorkflowTemplateLibrary(): WorkflowTemplateLibrary {
  return new WorkflowTemplateLibrary();
}

/**
 * Template library singleton
 */
let templateLibraryInstance: WorkflowTemplateLibrary | null = null;

export function getWorkflowTemplateLibrary(): WorkflowTemplateLibrary {
  if (!templateLibraryInstance) {
    templateLibraryInstance = new WorkflowTemplateLibrary();
  }
  return templateLibraryInstance;
}
