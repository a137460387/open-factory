import {
  MediaSemaphore,
  backgroundMediaPool,
  uiFeedbackPool,
} from './media-concurrency';

/**
 * 兼容旧 API:BackgroundMediaTaskQueue 即 MediaSemaphore。
 * 保留该类名以避免破坏既有调用方与测试。
 */
export { MediaSemaphore as BackgroundMediaTaskQueue } from './media-concurrency';

/** 排队运行一个后台/批量媒体任务(默认走共享后台池)。 */
export function runBackgroundMediaTask<T>(
  run: () => Promise<T> | T,
  pool: MediaSemaphore = backgroundMediaPool,
): Promise<T> {
  return pool.run(run);
}

/** 排队运行一个实时 UI 反馈任务(时间线缩略图/波形等),走独立 UI 池。 */
export function runUiFeedbackTask<T>(run: () => Promise<T> | T): Promise<T> {
  return uiFeedbackPool.run(run);
}
