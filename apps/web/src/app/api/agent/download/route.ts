import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Phase-1 placeholder. The native desktop agent (Windows/Mac/Linux, with a visible tray icon) ships in phase 2.
 * For now this serves a README describing how the agent pairs and what it records, so the install flow is wired
 * end-to-end. The real installer will be served from here (or object storage) once built.
 */
export async function GET() {
  const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';
  const body = `MatrixHR Activity Agent — setup
================================

The desktop agent is being finalised. When it is ready you will download an installer from this
same link and run it. During setup it asks for the one-time pairing key shown on your
"My Activity" page.

What the agent records: active/idle time, mouse and keyboard activity COUNTS (never which keys),
and the name of the app or website in focus. It never records your keystrokes, screen, clipboard
or the contents of anything you open. A tray icon is shown the whole time it runs.

Technical note (for IT): the agent posts batches to
  POST ${apiBase}/activity/ingest
with header  X-Device-Token: <your pairing key>
and a JSON body { agentVersion, samples: [{ windowStart, windowEnd, activeSeconds, idleSeconds,
mouseEvents, keyboardEvents, foregroundApp?, foregroundDomain? }] }.
`;
  return new NextResponse(body, {
    status: 200,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Content-Disposition': 'attachment; filename="matrixhr-agent-setup.txt"' },
  });
}
