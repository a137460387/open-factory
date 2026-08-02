/**
 * 媒体后台任务并发控制(审计 H2)。
 *
 * 提供两个互不感知的共享信号量:
 * - backgroundMediaPool:批量/后台任务(proxy、导入 waveform、封面帧批量),
 *   避免一次导入大量素材时瞬间撑满系统资源(AGENTS.md 规则 24)。
 * - uiFeedbackPool:时间线滚动等实时 UI 反馈任务(缩略图、波形、单发封面),
 *   保证用户交互不被后台批量任务饿死。
 */

export class MediaSemaphore {
  private active = 0;
  private readonly pending: Array<() => void> = [];

  constructor(readonly limit: number) {}

  get activeCount(): number {
    return this.active;
  }

  get pendingCount(): number {
    return this.pending.length;
  }

  /** Acquire a slot; resolves with a release function once a slot is free. */
  acquire(): Promise<() => void> {
    if (this.active < this.limit) {
      this.active += 1;
      return Promise.resolve(this.createRelease());
    }
    return new Promise<() => void>((resolve) => {
      this.pending.push(() => {
        this.active += 1;
        resolve(this.createRelease());
      });
    });
  }

  /** Run a task, holding one slot until it settles. */
  run<T>(task: () => Promise<T> | T): Promise<T> {
    return this.acquire().then((release) =>
      Promise.resolve()
        .then(task)
        .finally(release),
    );
  }

  private createRelease(): () => void {
    let released = false;
    return () => {
      if (released) {
        return;
      }
      released = true;
      this.active -= 1;
      const next = this.pending.shift();
      next?.();
    };
  }
}

/** 后台批量任务默认上限:half of CPU cores,cap 4。 */
export function defaultBackgroundPoolLimit(): number {
  const cores =
    typeof navigator !== 'undefined' && Number.isFinite(navigator.hardwareConcurrency)
      ? navigator.hardwareConcurrency
      : 4;
  return Math.min(4, Math.max(1, Math.floor(cores / 2)));
}

/** 实时 UI 反馈池固定上限,保持既有 background-media-task-queue 量级(3)。 */
export const UI_FEEDBACK_POOL_LIMIT = 3;

/** 批量/后台任务共享池(proxy、导入 waveform、封面帧批量)。 */
export const backgroundMediaPool = new MediaSemaphore(defaultBackgroundPoolLimit());

/** 实时 UI 反馈池(时间线缩略图、波形、单发封面候选)。 */
export const uiFeedbackPool = new MediaSemaphore(UI_FEEDBACK_POOL_LIMIT);
