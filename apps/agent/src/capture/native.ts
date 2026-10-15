import type { Capture, InputCounter } from '../types';

/**
 * Real OS capture. Loads native modules dynamically so the core (and tests) run without them.
 *   uiohook-napi  — global mouse/keyboard event stream; we COUNT events and discard everything else (keys, coords).
 *   active-win    — the foreground window's owning app, and on macOS/some browsers the URL (host only is kept).
 *   idle          — provided by Electron's powerMonitor when running in Electron; headless uses uiohook activity.
 * Nothing here ever reads key identities, mouse positions, window titles' contents, URLs' paths, or the screen.
 */
export async function createNativeCapture(idleProvider?: () => number): Promise<Capture> {
  let uiohook: any;
  try { uiohook = require('uiohook-napi'); } catch { uiohook = null; }
  let activeWin: any;
  try { activeWin = require('active-win'); } catch { activeWin = null; }

  let mouse = 0, keyboard = 0, lastInputMs = Date.now();
  const input: InputCounter = {
    start() {
      if (!uiohook?.uIOhook) return;
      uiohook.uIOhook.on('keydown', () => { keyboard++; lastInputMs = Date.now(); });
      uiohook.uIOhook.on('mousemove', () => { mouse++; lastInputMs = Date.now(); });
      uiohook.uIOhook.on('mousedown', () => { mouse++; lastInputMs = Date.now(); });
      uiohook.uIOhook.on('wheel', () => { mouse++; lastInputMs = Date.now(); });
      uiohook.uIOhook.start();
    },
    stop() { try { uiohook?.uIOhook?.stop(); } catch { /* ignore */ } },
    drain() { const m = mouse, k = keyboard; mouse = 0; keyboard = 0; return { mouse: m, keyboard: k }; },
  };

  const hostOf = (url?: string) => { try { return url ? new URL(url).hostname.replace(/^www\./, '') : undefined; } catch { return undefined; } };

  return {
    input,
    foreground: {
      async sample() {
        if (!activeWin) return {};
        try {
          const w = await (activeWin.activeWindow ? activeWin.activeWindow() : activeWin());
          // app owner name only; domain host only (dropped by the server too if the tenant disabled it)
          return { app: w?.owner?.name, domain: hostOf(w?.url) };
        } catch { return {}; }
      },
    },
    idle: {
      idleSeconds() {
        if (idleProvider) return idleProvider(); // Electron powerMonitor.getSystemIdleTime()
        return Math.floor((Date.now() - lastInputMs) / 1000); // headless fallback: time since last counted input
      },
    },
    dispose() { input.stop(); },
  };
}
