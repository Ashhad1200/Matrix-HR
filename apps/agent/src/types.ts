/** One window of recorded activity. Counts and durations only — never any content. Matches the server's IngestDto. */
export interface ActivitySample {
  windowStart: string; // ISO
  windowEnd: string;   // ISO
  activeSeconds: number;
  idleSeconds: number;
  mouseEvents: number;    // COUNT of mouse events, never positions or targets
  keyboardEvents: number; // COUNT of key events, never which keys
  foregroundApp?: string;    // app/window owner name only
  foregroundDomain?: string; // website host only (best-effort), never the path or query
}

export interface AgentConfig {
  serverUrl: string;   // e.g. https://matrixhr.treevoxa.com/api/v1
  deviceToken: string; // the pairing key; stored locally on this machine only
  deviceName?: string;
  windowSeconds: number;   // length of each sample window (default 60)
  flushSeconds: number;    // how often to send queued samples (default 60)
  idleThresholdSeconds: number; // input gap that counts as idle (default 60)
  paused?: boolean;
}

/** Counts global input events. Never records which keys or where the mouse is. */
export interface InputCounter {
  start(): void;
  stop(): void;
  /** Returns the counts since the last drain and resets them. */
  drain(): { mouse: number; keyboard: number };
}

/** The app/website currently in focus (names only). */
export interface ForegroundWatcher {
  sample(): Promise<{ app?: string; domain?: string }>;
}

/** Seconds since the last user input, from the OS. */
export interface IdleWatcher {
  idleSeconds(): number;
}

export interface Capture {
  input: InputCounter;
  foreground: ForegroundWatcher;
  idle: IdleWatcher;
  dispose?(): void;
}
