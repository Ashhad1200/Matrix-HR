# MatrixHR Activity Agent

The desktop agent for MatrixHR's **disclosed** work-activity monitoring. The employee installs it themselves from
their **My Activity** page, and it shows a **tray icon** the whole time it runs.

## What it records — and what it never records
Records **time and activity only**, in fixed windows (default 60s):
- active vs idle seconds (idle = no input for `idleThresholdSeconds`, from the OS),
- **counts** of mouse and keyboard events (never which keys, never positions),
- the **name** of the foreground app, and the **host** of the foreground website (best-effort; host only).

It **never** records keystrokes, the screen, the clipboard, window text, URL paths, or the contents of anything.
There is no AI in the agent. Samples are queued on disk and sent to the server; if the machine is offline they wait
and go up when it reconnects. If the agent is quit or uninstalled, the server notices it stopped reporting and alerts HR.

## Architecture
```
capture (native)                 core (pure, tested)
  uiohook-napi  → event counts → Aggregator → SampleQueue (durable) → client → POST /activity/ingest
  active-win    → app/host        (windows)     (offline-safe)         (X-Device-Token)
  powerMonitor  → idle seconds
         └────────────── Runner ties them together on timers ──────────────┘
Electron main → visible Tray + onboarding window + start-on-login
```
- `src/` is pure, cross-platform TypeScript (no Electron/native imports at module load — native deps are `require`d
  dynamically), so it runs headless and is unit-testable. **Windows, macOS and Linux share this exact code.**
- `electron/` is the visible tray shell. `src/headless.ts` is a GUI-less entry for servers/kiosks/testing.

## Build & package (Windows first)
On a **Windows** build machine (icons in `assets/` first — see `assets/README.md`):
```powershell
cd apps/agent
npm install            # pulls electron, electron-builder, uiohook-napi, active-win
npm test               # core unit tests
npm run dist:win       # → release/ : MatrixHR Activity Agent Setup x.y.z.exe (NSIS, per-user, starts on login)
```
Sign the installer with your code-signing certificate (set `CSC_LINK`/`CSC_KEY_PASSWORD` for electron-builder) so
Windows SmartScreen does not warn users.

Then **macOS** (on a Mac): `npm install && npm run dist:mac` → `.dmg` (notarize with `APPLE_ID`/`APPLE_APP_SPECIFIC_PASSWORD`).
Then **Linux**: `npm install && npm run dist:linux` → `.AppImage`.

Point the server's agent-download link (`apps/web/src/app/api/agent/download`) at the signed installer, or host it
in object storage and link that.

## Run without the GUI (testing / servers)
```bash
AGENT_SERVER=http://localhost:3001/api/v1 AGENT_TOKEN=mon_… AGENT_DEVICE_NAME=box npm run pair
npm run start:headless          # real OS capture (needs uiohook-napi/active-win installed)
AGENT_MOCK=1 npm run start:headless   # deterministic mock capture, no native deps
```

## Config
Stored per-user (`%APPDATA%\MatrixHRAgent\config.json` on Windows, `~/Library/Application Support/MatrixHRAgent` on
macOS, `~/.config/matrixhr-agent` on Linux), mode 0600: `serverUrl`, `deviceToken`, `deviceName`, window/flush/idle
seconds. The device token is the one-time pairing key from My Activity; only the server stores its hash.

## Status
Core, offline queue, ingest client, Runner, headless CLI, Electron tray shell and packaging config are complete and
tested (`npm test` + the live ingest E2E in `test/live-ingest.e2e.ts`). The native capture uses `uiohook-napi` and
`active-win`; install them on the build machine. This sandbox is headless Linux, so the tray GUI and native hooks are
built and verified on the target OS, not here — the server-facing pipeline is proven by the E2E against a live API.
