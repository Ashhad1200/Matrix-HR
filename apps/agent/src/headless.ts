import { createInterface } from 'readline';
import { loadConfig, saveConfig, defaultConfigPath, DEFAULTS } from './config';
import { Runner, AGENT_VERSION } from './runner';
import { createMockCapture } from './capture/mock';
import { createNativeCapture } from './capture/native';
import type { AgentConfig, Capture } from './types';

/**
 * Headless entry point for servers, kiosks and testing. The GUI build uses the same Runner from Electron.
 *   pair   — save the server URL + pairing key to the per-user config
 *   run    — start recording and sending (AGENT_MOCK=1 uses the deterministic mock capture instead of OS hooks)
 */
async function pickCapture(): Promise<Capture> {
  if (process.env.AGENT_MOCK === '1') return createMockCapture({ app: process.env.AGENT_MOCK_APP || 'Code.exe', domain: process.env.AGENT_MOCK_DOMAIN });
  return createNativeCapture();
}

async function ask(q: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((res) => rl.question(q, (a) => { rl.close(); res(a.trim()); }));
}

async function main() {
  const cmd = process.argv[2];
  if (cmd === 'pair') {
    const serverUrl = process.env.AGENT_SERVER || await ask('Server URL (e.g. https://matrixhr.treevoxa.com/api/v1): ');
    const deviceToken = process.env.AGENT_TOKEN || await ask('Pairing key (from your My Activity page): ');
    const deviceName = process.env.AGENT_DEVICE_NAME || await ask('Name for this computer: ');
    saveConfig({ serverUrl, deviceToken, deviceName, ...DEFAULTS });
    console.log(`Saved to ${defaultConfigPath()}`);
    return;
  }
  if (cmd === 'run') {
    const cfg: AgentConfig | null = loadConfig();
    if (!cfg) { console.error('Not paired. Run: agent pair'); process.exit(1); }
    const capture = await pickCapture();
    const runner = new Runner(cfg, capture, (m) => console.log(`[agent] ${m}`), process.env.AGENT_QUEUE);
    runner.start();
    console.log(`MatrixHR agent ${AGENT_VERSION} running (mock=${process.env.AGENT_MOCK === '1'}). Recording time and activity only. Ctrl+C to stop.`);
    const shutdown = async () => { console.log('\nstopping…'); await runner.stop(); process.exit(0); };
    process.on('SIGINT', shutdown); process.on('SIGTERM', shutdown);
    // keep alive
    setInterval(() => {}, 1 << 30);
    return;
  }
  console.log('Usage: agent <pair|run>');
  process.exit(1);
}
main().catch((e) => { console.error(e); process.exit(1); });
