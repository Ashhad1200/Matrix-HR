import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname } from 'path';
import type { ActivitySample } from './types';

/**
 * Durable, size-capped queue of unsent samples. Survives restarts and network outages — if the computer is offline
 * the samples wait here and go up when it reconnects, so a closed laptop lid never loses the day.
 */
export class SampleQueue {
  private items: ActivitySample[] = [];
  constructor(private path: string, private max = 20000) {
    try { if (existsSync(path)) this.items = JSON.parse(readFileSync(path, 'utf8')); } catch { this.items = []; }
  }
  size() { return this.items.length; }
  enqueue(s: ActivitySample) {
    this.items.push(s);
    if (this.items.length > this.max) this.items.splice(0, this.items.length - this.max); // drop oldest
    this.persist();
  }
  /** Take up to `n` oldest samples without removing them (removed only after the server accepts them). */
  peek(n: number) { return this.items.slice(0, n); }
  /** Remove the first `n` samples after a successful send. */
  ack(n: number) { this.items.splice(0, n); this.persist(); }
  private persist() {
    try { mkdirSync(dirname(this.path), { recursive: true }); writeFileSync(this.path, JSON.stringify(this.items)); } catch { /* best effort */ }
  }
}
