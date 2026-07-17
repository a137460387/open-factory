/**
 * Plugin system type definitions.
 *
 * Defines the four plugin categories (Effect, Export, Workflow, AI Model),
 * lifecycle hooks, and the plugin API surface. All types are pure interfaces
 * with no runtime dependencies.
 */

// --- Plugin categories ---

/** Plugin category. */
export type PluginCategory = 'effect' | 'export' | 'workflow' | 'ai-model';

/** Plugin lifecycle status. */
export type PluginStatus = 'registered' | 'loading' | 'loaded' | 'active' | 'error' | 'unloaded';

/** Plugin permission scopes. */
export type PluginPermission =
  | 'read-project'
  | 'write-project'
  | 'read-media'
  | 'export-hook'
  | 'menu-register'
  | 'timeline-mutation'
  | 'ai-inference'
  | 'network-access';

// --- Plugin manifest ---

/** Plugin manifest (metadata). */
export interface PluginManifest {
  /** Unique plugin identifier (e.g., 'com.example.my-plugin'). */
  id: string;
  /** Human-readable name. */
  name: string;
  /** Semver version string. */
  version: string;
  /** Short description. */
  description?: string;
  /** Plugin category. */
  category: PluginCategory;
  /** Author name or organization. */
  author?: string;
  /** Plugin homepage URL. */
  homepage?: string;
  /** Required permissions. */
  permissions?: PluginPermission[];
  /** Minimum Open Factory version required. */
  minAppVersion?: string;
  /** Entry point (relative path to module). */
  main?: string;
  /** Whether this is a development-only plugin. */
  dev?: boolean;
}

// --- Plugin lifecycle ---

/** Context provided to plugins during lifecycle events. */
export interface PluginContext {
  /** Plugin manifest. */
  manifest: PluginManifest;
  /** Logger scoped to this plugin. */
  logger: PluginLogger;
  /** Plugin-scoped persistent storage. */
  storage: PluginStorage;
  /** Event emitter for inter-plugin communication. */
  events: PluginEventEmitter;
}

/** Plugin logger interface. */
export interface PluginLogger {
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
  debug(message: string, ...args: unknown[]): void;
}

/** Plugin-scoped key-value storage. */
export interface PluginStorage {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
  keys(): Promise<string[]>;
}

/** Plugin event emitter for inter-plugin communication. */
export interface PluginEventEmitter {
  emit(event: string, data?: unknown): void;
  on(event: string, handler: (data: unknown) => void): () => void;
  once(event: string, handler: (data: unknown) => void): () => void;
}

/** Plugin lifecycle hooks. */
export interface PluginLifecycle {
  /** Called when the plugin is first loaded. */
  onLoad?(context: PluginContext): void | Promise<void>;
  /** Called when the plugin is activated. */
  onActivate?(context: PluginContext): void | Promise<void>;
  /** Called when the plugin is deactivated. */
  onDeactivate?(context: PluginContext): void | Promise<void>;
  /** Called when the plugin is unloaded. */
  onUnload?(context: PluginContext): void | Promise<void>;
  /** Called when the plugin encounters an error. */
  onError?(error: Error, context: PluginContext): void;
}

// --- Effect plugin ---

/** Effect parameter definition. */
export interface EffectParameter {
  /** Parameter name. */
  name: string;
  /** Display label. */
  label: string;
  /** Parameter type. */
  type: 'number' | 'boolean' | 'color' | 'select' | 'text';
  /** Default value. */
  defaultValue: unknown;
  /** Minimum value (for number type). */
  min?: number;
  /** Maximum value (for number type). */
  max?: number;
  /** Step value (for number type). */
  step?: number;
  /** Options (for select type). */
  options?: Array<{ label: string; value: unknown }>;
}

/** Effect plugin interface. */
export interface EffectPlugin extends PluginLifecycle {
  /** Effect unique identifier. */
  effectId: string;
  /** Effect display name. */
  effectName: string;
  /** Effect category. */
  effectCategory: string;
  /** Effect parameters. */
  parameters: EffectParameter[];
  /** Whether this is a GPU-accelerated effect. */
  gpuAccelerated?: boolean;

  /**
   * Apply the effect to a frame.
   * @param params - Current parameter values.
   * @param frameData - Input frame pixel data (RGBA).
   * @param width - Frame width.
   * @param height - Frame height.
   * @returns Processed frame pixel data.
   */
  applyEffect(
    params: Record<string, unknown>,
    frameData: Uint8ClampedArray,
    width: number,
    height: number,
  ): Uint8ClampedArray | Promise<Uint8ClampedArray>;

  /**
   * Generate FFmpeg filter expression for this effect.
   * @param params - Current parameter values.
   * @returns FFmpeg filter string.
   */
  toFFmpegFilter?(params: Record<string, unknown>): string;
}

// --- Export plugin ---

/** Export preset defined by a plugin. */
export interface ExportPreset {
  /** Preset unique ID. */
  id: string;
  /** Display name. */
  name: string;
  /** File extension (e.g., 'mp4', 'webm'). */
  extension: string;
  /** MIME type. */
  mimeType: string;
  /** FFmpeg arguments template. */
  ffmpegArgs: string[];
  /** Preset description. */
  description?: string;
  /** Whether this preset requires GPU. */
  requiresGpu?: boolean;
}

/** Export plugin interface. */
export interface ExportPlugin extends PluginLifecycle {
  /** Export preset ID. */
  presetId: string;
  /** Export presets provided by this plugin. */
  presets: ExportPreset[];

  /**
   * Prepare export arguments.
   * @param preset - Selected preset.
   * @param options - Export options.
   * @returns Additional FFmpeg arguments.
   */
  prepareExport(
    preset: ExportPreset,
    options: ExportOptions,
  ): string[] | Promise<string[]>;

  /**
   * Post-process after export completes.
   * @param outputPath - Path to exported file.
   * @param preset - Selected preset.
   */
  postExport?(
    outputPath: string,
    preset: ExportPreset,
  ): void | Promise<void>;
}

/** Export options. */
export interface ExportOptions {
  /** Output file path. */
  outputPath: string;
  /** Video width. */
  width: number;
  /** Video height. */
  height: number;
  /** Frame rate. */
  fps: number;
  /** Video bitrate. */
  videoBitrate?: number;
  /** Audio bitrate. */
  audioBitrate?: number;
  /** Duration in seconds. */
  duration?: number;
}

// --- Workflow plugin ---

/** Workflow step definition. */
export interface WorkflowStep {
  /** Step unique ID. */
  id: string;
  /** Display name. */
  name: string;
  /** Step description. */
  description?: string;
  /** Whether this step requires user input. */
  requiresInput?: boolean;
}

/** Workflow plugin interface. */
export interface WorkflowPlugin extends PluginLifecycle {
  /** Workflow unique ID. */
  workflowId: string;
  /** Workflow display name. */
  workflowName: string;
  /** Workflow description. */
  workflowDescription?: string;
  /** Workflow steps. */
  steps: WorkflowStep[];

  /**
   * Execute a workflow step.
   * @param step - The step to execute.
   * @param input - Input data from previous step or user.
   * @returns Output data for next step.
   */
  executeStep(
    step: WorkflowStep,
    input: unknown,
  ): unknown | Promise<unknown>;

  /**
   * Validate workflow input.
   * @param input - User-provided input.
   * @returns Validation result.
   */
  validateInput?(input: unknown): { valid: boolean; errors?: string[] };
}

// --- AI Model plugin ---

/** AI model capabilities. */
export type AIModelCapability =
  | 'scene-detection'
  | 'object-detection'
  | 'face-detection'
  | 'speech-to-text'
  | 'text-to-speech'
  | 'translation'
  | 'summarization'
  | 'style-transfer'
  | 'super-resolution'
  | 'noise-reduction'
  | 'custom';

/** AI model metadata. */
export interface AIModelInfo {
  /** Model unique ID. */
  modelId: string;
  /** Display name. */
  name: string;
  /** Model version. */
  version: string;
  /** Model capabilities. */
  capabilities: AIModelCapability[];
  /** Model description. */
  description?: string;
  /** Whether the model runs locally. */
  local: boolean;
  /** Model file size in bytes (for local models). */
  modelSize?: number;
  /** Required GPU memory in MB. */
  gpuMemoryMb?: number;
  /** Supported input formats. */
  inputFormats?: string[];
}

/** AI inference request. */
export interface AIInferenceRequest {
  /** Model ID to use. */
  modelId: string;
  /** Input data (type depends on model). */
  input: unknown;
  /** Inference parameters. */
  params?: Record<string, unknown>;
  /** Abort signal for cancellation. */
  abortSignal?: AbortSignal;
}

/** AI inference result. */
export interface AIInferenceResult<T = unknown> {
  /** Inference output. */
  output: T;
  /** Inference time in milliseconds. */
  inferenceTimeMs: number;
  /** Model confidence (0.0 ~ 1.0). */
  confidence?: number;
  /** Additional metadata. */
  metadata?: Record<string, unknown>;
}

/** AI Model plugin interface. */
export interface AIModelPlugin extends PluginLifecycle {
  /** Model information. */
  modelInfo: AIModelInfo;

  /**
   * Load the model into memory.
   * @returns Whether the model loaded successfully.
   */
  loadModel(): Promise<boolean>;

  /**
   * Run inference.
   * @param request - Inference request.
   * @returns Inference result.
   */
  infer<T = unknown>(request: AIInferenceRequest): Promise<AIInferenceResult<T>>;

  /**
   * Check if the model is currently loaded.
   */
  isModelLoaded(): boolean;

  /**
   * Unload the model from memory.
   */
  unloadModel(): Promise<void>;
}

// --- Union type ---

/** Any plugin type. */
export type AnyPlugin =
  | EffectPlugin
  | ExportPlugin
  | WorkflowPlugin
  | AIModelPlugin;

/** Plugin registration entry. */
export interface PluginRegistration {
  /** Plugin manifest. */
  manifest: PluginManifest;
  /** Plugin implementation. */
  plugin: AnyPlugin;
  /** Current status. */
  status: PluginStatus;
  /** Error if status is 'error'. */
  error?: Error;
  /** Registration timestamp. */
  registeredAt: number;
  /** Last status change timestamp. */
  lastStatusChange: number;
}

// --- Plugin API (host functions available to plugins) ---

/** API surface exposed to plugins by the host application. */
export interface PluginHostAPI {
  /** Get current project data. */
  getProject(): Promise<unknown>;
  /** Update project data. */
  updateProject(project: unknown): Promise<void>;
  /** Register a menu item. */
  registerMenu(item: { id: string; label: string; action: () => void }): void;
  /** Show a toast notification. */
  showToast(kind: 'info' | 'warning' | 'error', title: string, message?: string): void;
  /** Read a text file. */
  readTextFile(path: string): Promise<string>;
  /** Write a text file. */
  writeTextFile(path: string, contents: string): Promise<void>;
}
