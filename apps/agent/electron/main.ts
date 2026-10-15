/* eslint-disable @typescript-eslint/no-var-requires */
// Electron main process: the visible tray app. Loaded only in the packaged build; typed loosely so the
// repo typechecks without electron's types installed. The real capture + runner come from ../src.
const electron: any = require('electron');
const { app, Tray, Menu, BrowserWindow, nativeImage, powerMonitor, shell, ipcMain } = electron;
const path = require('path');

import { loadConfig, saveConfig, defaultConfigPath, DEFAULTS } from '../src/config';
import { Runner, AGENT_VERSION } from '../src/runner';
import { createNativeCapture } from '../src/capture/native';

let tray: any = null;
let runner: Runner | null = null;
let onboarding: any = null;

const userDir = () => app.getPath('userData');
const cfgPath = () => path.join(userDir(), 'config.json');
const queuePath = () => path.join(userDir(), 'queue.json');

async function startRunner() {
  const cfg = loadConfig(cfgPath());
  if (!cfg) return false;
  // Idle comes from the OS via Electron; input counts + foreground from the native capture.
  const capture = await createNativeCapture(() => powerMonitor.getSystemIdleTime());
  runner = new Runner(cfg, capture, (m) => console.log('[agent]', m), queuePath());
  runner.start();
  return true;
}

function openOnboarding() {
  if (onboarding) { onboarding.focus(); return; }
  onboarding = new BrowserWindow({
    width: 480, height: 560, resizable: false, title: 'MatrixHR Activity Agent',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true },
  });
  onboarding.loadFile(path.join(__dirname, '..', 'electron', 'onboarding.html'));
  onboarding.on('closed', () => { onboarding = null; });
}

function rebuildMenu() {
  if (!tray) return;
  const st = runner?.status();
  const paired = !!loadConfig(cfgPath());
  const items: any[] = [
    { label: `MatrixHR Agent ${AGENT_VERSION}`, enabled: false },
    { label: st ? (st.paused ? 'Paused' : `Recording · ${st.queued} queued`) : (paired ? 'Starting…' : 'Not set up'), enabled: false },
    { type: 'separator' },
  ];
  if (!paired) items.push({ label: 'Set up…', click: openOnboarding });
  else {
    items.push({ label: st?.paused ? 'Resume recording' : 'Pause recording', click: () => { runner?.setPaused(!st?.paused); rebuildMenu(); } });
    items.push({ label: 'Send now', click: () => runner?.flush() });
  }
  items.push({ type: 'separator' });
  items.push({ label: 'What is recorded…', click: () => shell.openExternal('https://matrixhr.treevoxa.com/my-activity') });
  items.push({ label: 'Quit', click: () => { app.quit(); } });
  tray.setContextMenu(Menu.buildFromTemplate(items));
  tray.setToolTip(st ? (st.paused ? 'MatrixHR Agent — paused' : 'MatrixHR Agent — recording time & activity only') : 'MatrixHR Agent');
}

function makeTrayIcon() {
  // A tiny built-in dot so the app always has a visible tray presence even before assets are bundled.
  const img = nativeImage.createFromDataURL('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAKElEQVR4nGNgoBAw4lDwn4GB4T8DAwMDEwMDAwMDA8OowaMGjxo8AAB4oQMBZrq2vQAAAABJRU5ErkJggg==');
  try { const ico = path.join(__dirname, '..', 'assets', 'icon.png'); const f = nativeImage.createFromPath(ico); if (!f.isEmpty()) return f; } catch { /* fall back to dot */ }
  return img;
}

// Single instance only — launching again just shows the menu/onboarding.
if (!app.requestSingleInstanceLock()) { app.quit(); } else {
  app.on('second-instance', () => { if (onboarding) onboarding.focus(); });

  app.whenReady().then(async () => {
    if (process.platform === 'darwin') app.dock?.hide(); // tray-only
    // Start on login, visibly (the user set this up themselves).
    app.setLoginItemSettings({ openAtLogin: true, args: ['--hidden'] });

    tray = new Tray(makeTrayIcon());
    rebuildMenu();
    setInterval(rebuildMenu, 5000).unref?.();

    const started = await startRunner();
    if (!started) openOnboarding();
    rebuildMenu();
  });

  // Pairing from the onboarding window.
  ipcMain.handle('pair', async (_e: any, data: { serverUrl: string; deviceToken: string; deviceName: string }) => {
    if (!data?.serverUrl || !data?.deviceToken) return { ok: false, error: 'Server URL and pairing key are required' };
    saveConfig({ serverUrl: data.serverUrl.trim(), deviceToken: data.deviceToken.trim(), deviceName: (data.deviceName || '').trim(), ...DEFAULTS }, cfgPath());
    if (runner) await runner.stop();
    const ok = await startRunner();
    rebuildMenu();
    if (onboarding) onboarding.close();
    return { ok };
  });
  ipcMain.handle('config-path', () => defaultConfigPath(userDir()));

  app.on('window-all-closed', (e: any) => { e.preventDefault(); }); // stay alive in the tray
  app.on('before-quit', async () => { if (runner) await runner.stop(); });
}
