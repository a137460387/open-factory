import { invoke } from '@tauri-apps/api/core';
import type { VideoGenTaskDb } from './types';

export async function saveVideoGenTask(task: VideoGenTaskDb): Promise<void> {
  await invoke('save_video_gen_task', { task });
}

export async function listVideoGenTasks(statusFilter?: string): Promise<VideoGenTaskDb[]> {
  return invoke('list_video_gen_tasks', {
    statusFilter: statusFilter ?? null,
  });
}

export async function updateVideoGenTaskStatus(
  id: string,
  status?: string,
  progress?: number,
  stage?: string,
  outputPath?: string,
  errorMessage?: string,
  errorType?: string,
  startedAt?: string,
  completedAt?: string,
  seq: number = 0,
): Promise<void> {
  await invoke('update_video_gen_task_status', {
    id,
    status: status ?? null,
    progress: progress ?? null,
    stage: stage ?? null,
    outputPath: outputPath ?? null,
    errorMessage: errorMessage ?? null,
    errorType: errorType ?? null,
    startedAt: startedAt ?? null,
    completedAt: completedAt ?? null,
    seq,
  });
}

export async function deleteVideoGenTask(id: string): Promise<void> {
  await invoke('delete_video_gen_task', { id });
}

export async function cleanupVideoGenTasks(keepCompleted?: number): Promise<void> {
  await invoke('cleanup_video_gen_tasks', {
    keepCompleted: keepCompleted ?? null,
  });
}
