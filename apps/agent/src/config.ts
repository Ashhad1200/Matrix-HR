import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { homedir } from 'os';
import type { AgentConfig } from './types';

export const DEFAULTS = { windowSeconds: 60, flushSeconds: 60, idleThresholdSeconds: 60 };

/** Per-user config location. On the real app Electron passes its userData dir; headless falls back to the home dir. */
export function defaultConfigPath(baseDir?: string): string {
  const base = baseDir
    || process.env.AGENT_CONFIG_DIR
    || (process.platform === 'win32' ? join(process.env.APPDATA || homedir(), 'MatrixHRAgent')
      : process.platform === 'darwin' ? join(homedir(), 'Library', 'Application Support', 'MatrixHRAgent')
      : join(process.env.XDG_CONFIG_HOME || join(homedir(), '.config'), 'matrixhr-agent'));
  return join(base, 'config.json');
}

export function loadConfig(path = defaultConfigPath()): AgentConfig | null {
  try {
    if (!existsSync(path)) return null;
    const raw = JSON.parse(readFileSync(path, 'utf8'));
    if (!raw.serverUrl || !raw.deviceToken) return null;
    return { ...DEFAULTS, ...raw };
  } catch { return null; }
}

export function saveConfig(cfg: AgentConfig, path = defaultConfigPath()): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify({ ...DEFAULTS, ...cfg }, null, 2), { mode: 0o600 });
}
