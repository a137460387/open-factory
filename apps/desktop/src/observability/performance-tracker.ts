import { metrics } from './metrics';
import { logger } from './logger';

export class PerformanceTracker {
  static async trackOperation<T>(name: string, fn: () => Promise<T>): Promise<T> {
    const start = performance.now();
    try {
      const result = await fn();
      const duration = performance.now() - start;
      metrics.histogram(`operation.${name}.duration`, duration);
      if (import.meta.env.DEV) {
        logger.debug(`Operation ${name} completed`, { duration: `${duration.toFixed(1)}ms` });
      }
      return result;
    } catch (error) {
      const duration = performance.now() - start;
      metrics.histogram(`operation.${name}.error_duration`, duration);
      throw error;
    }
  }

  static trackRender(componentName: string): () => void {
    if (!import.meta.env.DEV) return () => {};
    const start = performance.now();
    return () => {
      const duration = performance.now() - start;
      metrics.histogram(`render.${componentName}.duration`, duration);
    };
  }
}
