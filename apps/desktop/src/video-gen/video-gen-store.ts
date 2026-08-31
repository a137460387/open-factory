import { create } from 'zustand';
import type { VideoGenerationParams } from '../hooks/useVideoGeneration';
import type { VideoGenTaskDb } from '../lib/tauri-bridge/types';
import {
  saveVideoGenTask,
  updateVideoGenTaskStatus,
  deleteVideoGenTask,
  cleanupVideoGenTasks,
  listVideoGenTasks,
} from '../lib/tauri-bridge/video-gen';
import { logError } from '../lib/error-handlers';

/** Video generation task status */
export type VideoGenTaskStatus = 'queued' | 'running' | 'completed' | 'failed' | 'canceled';

/** Video generation task */
export interface VideoGenTask {
  id: string;
  params: VideoGenerationParams;
  status: VideoGenTaskStatus;
  progress: number;
  stage: string;
  videoPath: string | null;
  error: string | null;
  errorType: string | null;
  createdAt: number;
  startedAt: number | null;
  finishedAt: number | null;
}

/** Store state */
export interface VideoGenQueueState {
  tasks: VideoGenTask[];
  activeTaskId: string | null;
  maxConcurrent: number;
  /** Per-task monotonic seq counter for DB write ordering */
  taskSeqMap: Map<string, number>;
  init: () => Promise<void>;
  reloadFromDb: () => Promise<void>;
  addTask: (params: VideoGenerationParams) => VideoGenTask;
  startNextTask: () => string | null;
  updateTaskProgress: (taskId: string, progress: number, stage: string) => void;
  completeTask: (taskId: string, videoPath: string) => void;
  failTask: (taskId: string, error: string, errorType?: string) => void;
  cancelTask: (taskId: string) => void;
  removeTask: (taskId: string) => void;
  clearCompleted: () => void;
  getTask: (taskId: string) => VideoGenTask | undefined;
  getActiveTask: () => VideoGenTask | undefined;
  getQueuedTasks: () => VideoGenTask[];
}

let taskCounter = 0;

function generateTaskId(): string {
  taskCounter += 1;
  return `vidgen-${Date.now()}-${taskCounter}`;
}

function tsToIso(ts: number): string {
  return new Date(ts).toISOString();
}

function isoToTs(iso: string): number {
  return new Date(iso).getTime();
}

function taskToDb(task: VideoGenTask, seq: number): VideoGenTaskDb {
  return {
    id: task.id,
    status: task.status,
    progress: task.progress,
    stage: task.stage,
    input_path: task.params.imagePath ?? null,
    prompt: task.params.prompt,
    negative_prompt: task.params.negativePrompt ?? null,
    steps: task.params.steps,
    guidance_scale: task.params.cfgScale,
    fps: task.params.fps,
    num_frames: task.params.numFrames,
    resolution: task.params.resolution,
    output_dir: null,
    output_path: task.videoPath,
    error_message: task.error,
    error_type: task.errorType,
    created_at: tsToIso(task.createdAt),
    started_at: task.startedAt != null ? tsToIso(task.startedAt) : null,
    completed_at: task.finishedAt != null ? tsToIso(task.finishedAt) : null,
    seq,
  };
}

function dbToTask(row: VideoGenTaskDb): VideoGenTask {
  return {
    id: row.id,
    params: {
      prompt: row.prompt,
      negativePrompt: row.negative_prompt ?? undefined,
      imagePath: row.input_path ?? undefined,
      numFrames: row.num_frames,
      resolution: row.resolution,
      fps: row.fps,
      steps: row.steps,
      cfgScale: row.guidance_scale,
    },
    status: row.status as VideoGenTaskStatus,
    progress: row.progress,
    stage: row.stage,
    videoPath: row.output_path,
    error: row.error_message,
    errorType: row.error_type,
    createdAt: isoToTs(row.created_at),
    startedAt: row.started_at != null ? isoToTs(row.started_at) : null,
    finishedAt: row.completed_at != null ? isoToTs(row.completed_at) : null,
  };
}

/** Get next seq for a task and bump the counter */
function nextSeq(taskSeqMap: Map<string, number>, taskId: string): number {
  const seq = (taskSeqMap.get(taskId) || 0) + 1;
  taskSeqMap.set(taskId, seq);
  return seq;
}

export const useVideoGenQueueStore = create<VideoGenQueueState>((set, get) => ({
  tasks: [],
  activeTaskId: null,
  maxConcurrent: 1,
  taskSeqMap: new Map<string, number>(),

  init: async () => {
    try {
      const rows = await listVideoGenTasks();
      const tasks = rows.map(dbToTask);
      const running = tasks.find((t) => t.status === 'running');
      // Seed taskSeqMap from DB values
      const seqMap = new Map<string, number>();
      for (const row of rows) {
        seqMap.set(row.id, row.seq);
      }
      set({
        tasks,
        activeTaskId: running?.id ?? null,
        taskSeqMap: seqMap,
      });
    } catch (e) {
      logError('video-gen-store: init')(e);
    }
  },

  reloadFromDb: async () => {
    try {
      const rows = await listVideoGenTasks();
      const tasks = rows.map(dbToTask);
      const running = tasks.find((t) => t.status === 'running');
      // Seed taskSeqMap from DB values
      const seqMap = new Map<string, number>();
      for (const row of rows) {
        seqMap.set(row.id, row.seq);
      }
      set({
        tasks,
        activeTaskId: running?.id ?? null,
        taskSeqMap: seqMap,
      });
    } catch (e) {
      logError('video-gen-store: reloadFromDb')(e);
    }
  },

  addTask: (params) => {
    const task: VideoGenTask = {
      id: generateTaskId(),
      params,
      status: 'queued',
      progress: 0,
      stage: 'queued',
      videoPath: null,
      error: null,
      errorType: null,
      createdAt: Date.now(),
      startedAt: null,
      finishedAt: null,
    };
    set((state) => ({ tasks: [...state.tasks, task] }));
    const seq = 0;
    get().taskSeqMap.set(task.id, seq);
    saveVideoGenTask(taskToDb(task, seq)).catch(logError('video-gen-store: persist addTask'));
    return task;
  },

  startNextTask: () => {
    const state = get();
    if (state.activeTaskId) return null;
    const next = state.tasks.find((t) => t.status === 'queued');
    if (!next) return null;
    const now = Date.now();
    set((s) => ({
      activeTaskId: next.id,
      tasks: s.tasks.map((t) =>
        t.id === next.id ? { ...t, status: 'running' as const, startedAt: now, stage: 'starting' } : t,
      ),
    }));
    const seq = nextSeq(state.taskSeqMap, next.id);
    updateVideoGenTaskStatus(
      next.id,
      'running',
      undefined,
      'starting',
      undefined,
      undefined,
      undefined,
      tsToIso(now),
      undefined,
      seq,
    ).catch(logError('video-gen-store: persist startNextTask'));
    return next.id;
  },

  updateTaskProgress: (taskId, progress, stage) => {
    set((state) => ({
      tasks: state.tasks.map((t) => (t.id === taskId ? { ...t, progress, stage } : t)),
    }));
    const seq = nextSeq(get().taskSeqMap, taskId);
    updateVideoGenTaskStatus(
      taskId,
      undefined,
      progress,
      stage,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      seq,
    ).catch(logError('video-gen-store: persist updateTaskProgress'));
  },

  completeTask: (taskId, videoPath) => {
    const now = Date.now();
    set((state) => ({
      activeTaskId: state.activeTaskId === taskId ? null : state.activeTaskId,
      tasks: state.tasks.map((t) =>
        t.id === taskId
          ? { ...t, status: 'completed' as const, progress: 1, stage: 'completed', videoPath, finishedAt: now }
          : t,
      ),
    }));
    const seq = nextSeq(get().taskSeqMap, taskId);
    updateVideoGenTaskStatus(
      taskId,
      'completed',
      1,
      'completed',
      videoPath,
      undefined,
      undefined,
      undefined,
      tsToIso(now),
      seq,
    ).catch(logError('video-gen-store: persist completeTask'));
  },

  failTask: (taskId, error, errorType) => {
    const now = Date.now();
    set((state) => ({
      activeTaskId: state.activeTaskId === taskId ? null : state.activeTaskId,
      tasks: state.tasks.map((t) =>
        t.id === taskId
          ? { ...t, status: 'failed' as const, error, errorType: errorType ?? 'unknown', finishedAt: now }
          : t,
      ),
    }));
    const seq = nextSeq(get().taskSeqMap, taskId);
    updateVideoGenTaskStatus(
      taskId,
      'failed',
      undefined,
      undefined,
      undefined,
      error,
      errorType ?? 'unknown',
      undefined,
      tsToIso(now),
      seq,
    ).catch(logError('video-gen-store: persist failTask'));
  },

  cancelTask: (taskId) => {
    const now = Date.now();
    set((state) => ({
      activeTaskId: state.activeTaskId === taskId ? null : state.activeTaskId,
      tasks: state.tasks.map((t) => (t.id === taskId ? { ...t, status: 'canceled' as const, finishedAt: now } : t)),
    }));
    const seq = nextSeq(get().taskSeqMap, taskId);
    updateVideoGenTaskStatus(
      taskId,
      'canceled',
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      tsToIso(now),
      seq,
    ).catch(logError('video-gen-store: persist cancelTask'));
  },

  removeTask: (taskId) => {
    set((state) => ({
      tasks: state.tasks.filter((t) => t.id !== taskId),
      activeTaskId: state.activeTaskId === taskId ? null : state.activeTaskId,
    }));
    deleteVideoGenTask(taskId).catch(logError('video-gen-store: persist removeTask'));
  },

  clearCompleted: () => {
    set((state) => ({
      tasks: state.tasks.filter((t) => t.status === 'queued' || t.status === 'running'),
    }));
    cleanupVideoGenTasks().catch(logError('video-gen-store: persist clearCompleted'));
  },

  getTask: (taskId) => get().tasks.find((t) => t.id === taskId),

  getActiveTask: () => {
    const state = get();
    return state.tasks.find((t) => t.id === state.activeTaskId);
  },

  getQueuedTasks: () => get().tasks.filter((t) => t.status === 'queued'),
}));
