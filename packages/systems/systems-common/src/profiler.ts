/* eslint-disable @typescript-eslint/no-non-null-assertion */
/**
 * Performance profiling utilities for server-side systems.
 * Provides detailed timing information for initialization, geometry processing, and other operations.
 */

export interface TimingEntry {
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  metadata?: Record<string, unknown>;
  children?: TimingEntry[];
}

export interface ProfilerSummary {
  totalDuration: number;
  entries: Array<{
    name: string;
    duration: number;
    percentage: number;
    count: number;
    avgDuration: number;
    metadata?: Record<string, unknown>;
  }>;
}

/**
 * Performance profiler for tracking timing of system operations.
 * Useful for debugging slow initialization and processing on the server-side.
 */
export class PerformanceProfiler {
  private static instance: PerformanceProfiler | null = null;
  private entries: Map<string, TimingEntry[]> = new Map();
  private activeTimers: Map<string, { startTime: number; metadata?: Record<string, unknown> }> =
    new Map();
  private enabled: boolean = true;
  private logPrefix: string = "[Profiler]";

  private constructor() {}

  /**
   * Get the singleton profiler instance
   */
  public static getInstance(): PerformanceProfiler {
    if (!PerformanceProfiler.instance) {
      PerformanceProfiler.instance = new PerformanceProfiler();
    }
    return PerformanceProfiler.instance;
  }

  /**
   * Enable or disable profiling
   */
  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Check if profiling is enabled
   */
  public isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Start timing an operation
   * @param category - The category/system (e.g., "physics", "navigation")
   * @param name - The operation name (e.g., "init", "parseGLB")
   * @param metadata - Optional metadata to attach to the timing entry
   * @returns A unique timer key for stopping this timer
   */
  public startTimer(category: string, name: string, metadata?: Record<string, unknown>): string {
    if (!this.enabled) return "";

    const key = `${category}:${name}:${Date.now()}:${Math.random().toString(36).slice(2, 9)}`;
    const startTime = performance.now();

    this.activeTimers.set(key, { startTime, metadata });

    return key;
  }

  /**
   * Stop a timer and record the result
   * @param timerKey - The key returned from startTimer
   * @param additionalMetadata - Optional additional metadata to merge
   * @returns The duration in milliseconds, or -1 if timer not found
   */
  public stopTimer(timerKey: string, additionalMetadata?: Record<string, unknown>): number {
    if (!this.enabled || !timerKey) return -1;

    const timer = this.activeTimers.get(timerKey);
    if (!timer) {
      console.warn(`${this.logPrefix} Timer not found: ${timerKey}`);
      return -1;
    }

    const endTime = performance.now();
    const duration = endTime - timer.startTime;
    this.activeTimers.delete(timerKey);

    // Parse the key to get category and name
    const [category, name] = timerKey.split(":");

    const entry: TimingEntry = {
      name,
      startTime: timer.startTime,
      endTime,
      duration,
      metadata: { ...timer.metadata, ...additionalMetadata },
    };

    if (!this.entries.has(category)) {
      this.entries.set(category, []);
    }
    this.entries.get(category)!.push(entry);

    return duration;
  }

  /**
   * Convenience method to time an async operation
   * @param category - The category/system
   * @param name - The operation name
   * @param operation - The async function to time
   * @param metadata - Optional metadata
   * @returns The result of the operation
   */
  public async timeAsync<T>(
    category: string,
    name: string,
    operation: () => Promise<T>,
    metadata?: Record<string, unknown>,
  ): Promise<T> {
    const timerKey = this.startTimer(category, name, metadata);
    try {
      const result = await operation();
      const duration = this.stopTimer(timerKey);
      if (this.enabled && duration >= 0) {
        console.log(`${this.logPrefix} [${category}] ${name}: ${duration.toFixed(2)}ms`);
      }
      return result;
    } catch (error) {
      this.stopTimer(timerKey, { error: true });
      throw error;
    }
  }

  /**
   * Convenience method to time a sync operation
   * @param category - The category/system
   * @param name - The operation name
   * @param operation - The sync function to time
   * @param metadata - Optional metadata
   * @returns The result of the operation
   */
  public timeSync<T>(
    category: string,
    name: string,
    operation: () => T,
    metadata?: Record<string, unknown>,
  ): T {
    const timerKey = this.startTimer(category, name, metadata);
    try {
      const result = operation();
      const duration = this.stopTimer(timerKey);
      if (this.enabled && duration >= 0) {
        console.log(`${this.logPrefix} [${category}] ${name}: ${duration.toFixed(2)}ms`);
      }
      return result;
    } catch (error) {
      this.stopTimer(timerKey, { error: true });
      throw error;
    }
  }

  /**
   * Get a summary of all timing entries for a category
   * @param category - The category to summarize
   * @returns A summary of timing data
   */
  public getSummary(category: string): ProfilerSummary | null {
    const categoryEntries = this.entries.get(category);
    if (!categoryEntries || categoryEntries.length === 0) {
      return null;
    }

    // Group entries by name
    const grouped = new Map<string, TimingEntry[]>();
    let totalDuration = 0;

    for (const entry of categoryEntries) {
      if (entry.duration !== undefined) {
        totalDuration += entry.duration;
        if (!grouped.has(entry.name)) {
          grouped.set(entry.name, []);
        }
        grouped.get(entry.name)!.push(entry);
      }
    }

    const entries = Array.from(grouped.entries()).map(([name, timings]) => {
      const durations = timings.map((t) => t.duration!);
      const sum = durations.reduce((a, b) => a + b, 0);
      return {
        name,
        duration: sum,
        percentage: totalDuration > 0 ? (sum / totalDuration) * 100 : 0,
        count: timings.length,
        avgDuration: sum / timings.length,
        metadata: timings[0].metadata,
      };
    });

    // Sort by duration descending
    entries.sort((a, b) => b.duration - a.duration);

    return { totalDuration, entries };
  }

  /**
   * Print a formatted summary to console
   * @param category - The category to print, or undefined for all categories
   */
  public printSummary(category?: string): void {
    const categories = category ? [category] : Array.from(this.entries.keys());

    for (const cat of categories) {
      const summary = this.getSummary(cat);
      if (!summary) continue;

      console.log(
        `\n${this.logPrefix} ========== ${cat.toUpperCase()} PERFORMANCE SUMMARY ==========`,
      );
      console.log(`${this.logPrefix} Total time: ${summary.totalDuration.toFixed(2)}ms`);
      console.log(`${this.logPrefix} Breakdown:`);

      for (const entry of summary.entries) {
        const bar = "█".repeat(Math.ceil(entry.percentage / 5));
        console.log(
          `${this.logPrefix}   ${entry.name.padEnd(30)} ${entry.duration.toFixed(2).padStart(10)}ms (${entry.percentage.toFixed(1).padStart(5)}%) ${bar}`,
        );
        if (entry.count > 1) {
          console.log(
            `${this.logPrefix}     └─ ${entry.count} calls, avg: ${entry.avgDuration.toFixed(2)}ms`,
          );
        }
        if (entry.metadata && Object.keys(entry.metadata).length > 0) {
          console.log(`${this.logPrefix}     └─ metadata:`, entry.metadata);
        }
      }
      console.log(`${this.logPrefix} ${"=".repeat(50)}\n`);
    }
  }

  /**
   * Get all entries for a category
   * @param category - The category to get entries for
   * @returns Array of timing entries
   */
  public getEntries(category: string): TimingEntry[] {
    return this.entries.get(category) || [];
  }

  /**
   * Clear all timing data
   * @param category - Optional category to clear, or all if not specified
   */
  public clear(category?: string): void {
    if (category) {
      this.entries.delete(category);
    } else {
      this.entries.clear();
    }
  }

  /**
   * Get raw timing data as JSON for external analysis
   */
  public toJSON(): Record<string, TimingEntry[]> {
    const result: Record<string, TimingEntry[]> = {};
    for (const [category, entries] of this.entries) {
      result[category] = entries;
    }
    return result;
  }
}

// Export singleton accessor for convenience
export const profiler = PerformanceProfiler.getInstance();

// Expose profiler globally for console access
if (typeof window !== "undefined") {
  (window as any).profiler = profiler;
}

/**
 * Print a performance summary for all systems.
 * Can be called from the browser console: printProfilerSummary()
 */
export function printProfilerSummary(category?: string): void {
  profiler.printSummary(category);
}

// Also expose the print function globally
if (typeof window !== "undefined") {
  (window as any).printProfilerSummary = printProfilerSummary;
}
