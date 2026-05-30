import type { ParseProgressCallback } from './types';

/**
 * Yields execution to the event loop.
 * This allows the browser to render UI updates, handle interactions, etc.
 */
export async function yieldToUI(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Creates a stateful progress reporter that automatically calculates ETA
 * and prevents flooding the callback by throttling updates.
 */
export function createProgressReporter(
  onProgress?: ParseProgressCallback,
  throttleMs: number = 100, // min time between UI updates
) {
  if (!onProgress) {
    return (phase: string, current: number, total: number) => {};
  }

  const startTime = Date.now();
  let lastReportTime = 0;

  return (phase: string, current: number, total: number, force: boolean = false) => {
    const now = Date.now();

    // Only report if enough time has passed, or if forced (e.g. at 100%)
    if (!force && now - lastReportTime < throttleMs) {
      return;
    }

    lastReportTime = now;
    let etaString: string | undefined;

    if (current > 0 && total > 0 && current < total) {
      const elapsedMs = now - startTime;
      const progressRatio = current / total;

      // We need at least a tiny bit of elapsed time to make a sensible estimate
      if (elapsedMs > 500) {
        const totalEstimatedMs = elapsedMs / progressRatio;
        const remainingMs = totalEstimatedMs - elapsedMs;

        if (remainingMs > 1000) {
          const remainingSecs = Math.round(remainingMs / 1000);
          if (remainingSecs > 60) {
            const mins = Math.floor(remainingSecs / 60);
            const secs = remainingSecs % 60;
            etaString = `${mins}m ${secs}s`;
          } else {
            etaString = `${remainingSecs}s`;
          }
        } else {
          etaString = '< 1s';
        }
      }
    }

    onProgress({
      phase,
      current,
      total,
      eta: etaString,
    });
  };
}
