const DEFAULT_BACKGROUND_MEDIA_TASK_LIMIT = 3;

type PendingTask<T> = {
  run: () => Promise<T> | T;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
};

export class BackgroundMediaTaskQueue {
  private active = 0;
  private readonly pending: Array<PendingTask<unknown>> = [];

  constructor(private readonly maxConcurrent = DEFAULT_BACKGROUND_MEDIA_TASK_LIMIT) {}

  get activeCount(): number {
    return this.active;
  }

  get pendingCount(): number {
    return this.pending.length;
  }

  run<T>(run: () => Promise<T> | T): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.pending.push({ run, resolve, reject } as PendingTask<unknown>);
      this.drain();
    });
  }

  private drain(): void {
    while (this.active < this.maxConcurrent && this.pending.length > 0) {
      const task = this.pending.shift();
      if (!task) {
        return;
      }
      this.active += 1;
      Promise.resolve()
        .then(task.run)
        .then(task.resolve, task.reject)
        .finally(() => {
          this.active -= 1;
          this.drain();
        });
    }
  }
}

const backgroundMediaTaskQueue = new BackgroundMediaTaskQueue();

export function runBackgroundMediaTask<T>(run: () => Promise<T> | T): Promise<T> {
  return backgroundMediaTaskQueue.run(run);
}
