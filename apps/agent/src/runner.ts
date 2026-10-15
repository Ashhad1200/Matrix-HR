import { join } from 'path';
import { Aggregator } from './aggregator';
import { SampleQueue } from './queue';
import { postBatch } from './client';
import type { AgentConfig, Capture } from './types';

export const AGENT_VERSION = '0.1.0';

type Logger = (msg: string) => void;

/**
 * Ties capture → aggregator → durable queue → server together on timers. One tick per second feeds the aggregator;
 * a completed window becomes a queued sample; a flush timer drains the queue to the server (oldest first, acked only
 * after the server accepts them). Pausing stops recording without quitting.
 */
export class Runner {
  private agg: Aggregator;
  private queue: SampleQueue;
  private tickTimer?: NodeJS.Timeout;
  private flushTimer?: NodeJS.Timeout;
  private lastTick = Date.now();
  private paused = false;
  private flushing = false;
  private lastResult = '';

  constructor(private cfg: AgentConfig, private capture: Capture, private log: Logger = () => {}, queuePath?: string) {
    this.agg = new Aggregator({ windowSeconds: cfg.windowSeconds, idleThresholdSeconds: cfg.idleThresholdSeconds });
    this.queue = new SampleQueue(queuePath ?? join(process.env.AGENT_CONFIG_DIR || '.', 'queue.json'));
    this.paused = !!cfg.paused;
  }

  status() { return { paused: this.paused, queued: this.queue.size(), lastResult: this.lastResult, version: AGENT_VERSION }; }
  setPaused(p: boolean) { this.paused = p; if (p) this.capture.input.stop(); else this.capture.input.start(); }

  start() {
    if (!this.paused) this.capture.input.start();
    this.lastTick = Date.now();
    this.tickTimer = setInterval(() => this.tick().catch((e) => this.log(`tick error: ${e.message}`)), 1000);
    this.tickTimer.unref?.();
    this.flushTimer = setInterval(() => this.flush().catch((e) => this.log(`flush error: ${e.message}`)), this.cfg.flushSeconds * 1000);
    this.flushTimer.unref?.();
  }

  async stop() {
    if (this.tickTimer) clearInterval(this.tickTimer);
    if (this.flushTimer) clearInterval(this.flushTimer);
    // close the current window and try one last flush so a clean quit doesn't drop data
    const s = this.agg.flush(); if (s) this.queue.enqueue(s);
    this.capture.input.stop();
    await this.flush();
  }

  private async tick(now = Date.now()) {
    const elapsed = now - this.lastTick; this.lastTick = now;
    if (this.paused) { this.capture.input.drain(); return; } // discard counts while paused
    const input = this.capture.input.drain();
    const idleSeconds = this.capture.idle.idleSeconds();
    const fg = await this.capture.foreground.sample().catch(() => ({} as any));
    this.agg.tick({ mouse: input.mouse, keyboard: input.keyboard, idleSeconds, app: fg.app, domain: fg.domain }, elapsed);
    if (this.agg.isComplete(now)) { const s = this.agg.flush(now); if (s) this.queue.enqueue(s); }
  }

  async flush(): Promise<void> {
    if (this.flushing || this.queue.size() === 0) return;
    this.flushing = true;
    try {
      // send in batches of up to 500 (the server cap), oldest first
      while (this.queue.size() > 0) {
        const batch = this.queue.peek(500);
        const r = await postBatch(this.cfg.serverUrl, this.cfg.deviceToken, batch, AGENT_VERSION);
        if (r.ok) { this.queue.ack(batch.length); this.lastResult = `sent ${r.accepted ?? batch.length} at ${new Date().toISOString()}`; this.log(this.lastResult); }
        else {
          this.lastResult = `not sent: ${r.error}`; this.log(this.lastResult);
          if (r.status === 401) { this.log('device token rejected — stopping until re-paired'); }
          break; // keep samples queued; try again on the next flush
        }
      }
    } finally { this.flushing = false; }
  }
}
