import type { Capture } from '../types';

/**
 * Deterministic capture for headless testing and CI. Simulates a worker who is mostly active in VS Code with bursts
 * of typing and mouse movement, and goes idle on cue. Records counts only, exactly like the real capture.
 */
export function createMockCapture(opts?: { app?: string; domain?: string; idleAfterTicks?: number }): Capture {
  const app = opts?.app ?? 'Code.exe';
  const domain = opts?.domain;
  let ticks = 0;
  let pendingMouse = 0, pendingKeyboard = 0;
  const idleAfter = opts?.idleAfterTicks ?? Infinity;
  return {
    input: {
      start() { /* no-op */ },
      stop() { /* no-op */ },
      drain() { const m = pendingMouse, k = pendingKeyboard; pendingMouse = 0; pendingKeyboard = 0; return { mouse: m, keyboard: k }; },
    },
    foreground: { async sample() { return { app, domain }; } },
    idle: { idleSeconds() { ticks++; if (ticks > idleAfter) return 999; pendingMouse += 12; pendingKeyboard += 7; return 0; } },
  };
}
