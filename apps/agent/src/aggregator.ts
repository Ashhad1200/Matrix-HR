import type { ActivitySample } from './types';

/**
 * Folds per-tick capture readings into fixed-length windows. Each tick contributes its input counts and marks the
 * time as active or idle based on the OS idle gap. The foreground app/domain for the window is the most-seen one.
 * Pure and deterministic so it can be unit-tested; it holds no timers.
 */
export class Aggregator {
  private windowMs: number;
  private idleThreshold: number;
  private start: number;
  private mouse = 0;
  private keyboard = 0;
  private activeMs = 0;
  private idleMs = 0;
  private appMs = new Map<string, number>();
  private domainMs = new Map<string, number>();

  constructor(opts: { windowSeconds: number; idleThresholdSeconds: number }, now = Date.now()) {
    this.windowMs = opts.windowSeconds * 1000;
    this.idleThreshold = opts.idleThresholdSeconds;
    this.start = now;
  }

  /** Record one reading covering `elapsedMs` since the previous tick. */
  tick(reading: { mouse: number; keyboard: number; idleSeconds: number; app?: string; domain?: string }, elapsedMs: number) {
    this.mouse += reading.mouse;
    this.keyboard += reading.keyboard;
    const idle = reading.idleSeconds >= this.idleThreshold;
    if (idle) this.idleMs += elapsedMs; else this.activeMs += elapsedMs;
    // Attribute the focused app/domain only while active (idle time is not "using app X").
    if (!idle) {
      if (reading.app) this.appMs.set(reading.app, (this.appMs.get(reading.app) ?? 0) + elapsedMs);
      if (reading.domain) this.domainMs.set(reading.domain, (this.domainMs.get(reading.domain) ?? 0) + elapsedMs);
    }
  }

  /** True once the current window has run its full length. */
  isComplete(now = Date.now()): boolean { return now - this.start >= this.windowMs; }

  private top(m: Map<string, number>): string | undefined {
    let best: string | undefined; let bestMs = 0;
    for (const [k, v] of m) if (v > bestMs) { best = k; bestMs = v; }
    return best;
  }

  /** Close the window into a sample and reset for the next one. Returns null if nothing happened. */
  flush(now = Date.now()): ActivitySample | null {
    const end = now;
    const activeSeconds = Math.round(this.activeMs / 1000);
    const idleSeconds = Math.round(this.idleMs / 1000);
    const sample: ActivitySample | null = (activeSeconds + idleSeconds + this.mouse + this.keyboard) === 0 ? null : {
      windowStart: new Date(this.start).toISOString(),
      windowEnd: new Date(end).toISOString(),
      activeSeconds, idleSeconds, mouseEvents: this.mouse, keyboardEvents: this.keyboard,
      foregroundApp: this.top(this.appMs), foregroundDomain: this.top(this.domainMs),
    };
    this.start = end; this.mouse = 0; this.keyboard = 0; this.activeMs = 0; this.idleMs = 0;
    this.appMs.clear(); this.domainMs.clear();
    return sample;
  }
}
