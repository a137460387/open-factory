export type MetricType = 'counter' | 'gauge' | 'histogram';

export interface MetricEntry {
  name: string;
  type: MetricType;
  value: number;
  tags?: Record<string, string>;
  timestamp: string;
}

export interface MetricsTransport {
  send(entry: MetricEntry): void;
}

class BufferMetricsTransport implements MetricsTransport {
  private buffer: MetricEntry[] = [];
  private readonly maxSize = 1000;

  send(entry: MetricEntry): void {
    this.buffer.push(entry);
    if (this.buffer.length > this.maxSize) {
      this.buffer = this.buffer.slice(-this.maxSize);
    }
  }

  flush(): MetricEntry[] {
    const entries = [...this.buffer];
    this.buffer = [];
    return entries;
  }
}

export class MetricsCollector {
  private enabled: boolean;
  private transports: MetricsTransport[];
  private bufferTransport: BufferMetricsTransport;

  constructor(enabled: boolean = import.meta.env.VITE_METRICS_ENABLED === 'true', transports: MetricsTransport[] = []) {
    this.enabled = enabled;
    this.bufferTransport = new BufferMetricsTransport();
    this.transports = [this.bufferTransport, ...transports];
  }

  addTransport(transport: MetricsTransport): void {
    this.transports.push(transport);
  }

  recordMetric(name: string, value: number, type: MetricType = 'counter', tags?: Record<string, string>): void {
    if (!this.enabled) return;
    const entry: MetricEntry = {
      name,
      type,
      value,
      tags,
      timestamp: new Date().toISOString(),
    };
    for (const transport of this.transports) {
      transport.send(entry);
    }
  }

  increment(name: string, tags?: Record<string, string>): void {
    this.recordMetric(name, 1, 'counter', tags);
  }

  gauge(name: string, value: number, tags?: Record<string, string>): void {
    this.recordMetric(name, value, 'gauge', tags);
  }

  histogram(name: string, value: number, tags?: Record<string, string>): void {
    this.recordMetric(name, value, 'histogram', tags);
  }

  collectWebVitals(): void {
    if (!this.enabled || typeof window === 'undefined') return;

    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    if (nav) {
      this.histogram('web.ttfb', nav.responseStart - nav.requestStart);
    }

    if ('PerformanceObserver' in window) {
      try {
        const po = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.name === 'first-contentful-paint') {
              this.histogram('web.fcp', entry.startTime);
            }
          }
        });
        po.observe({ type: 'paint', buffered: true });
      } catch {
        // Paint timing not supported
      }

      try {
        const lcpPo = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const last = entries[entries.length - 1];
          if (last) {
            this.histogram('web.lcp', last.startTime);
          }
        });
        lcpPo.observe({ type: 'largest-contentful-paint', buffered: true });
      } catch {
        // LCP not supported
      }
    }
  }

  getBufferedMetrics(): MetricEntry[] {
    return this.bufferTransport.flush();
  }
}

export const metrics = new MetricsCollector();
