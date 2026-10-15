import type { ActivitySample } from './types';

export interface IngestResult { ok: boolean; status: number; accepted?: number; error?: string }

/** Posts a batch to the server's ingest endpoint with the device token. No user JWT — the device authenticates itself. */
export async function postBatch(serverUrl: string, token: string, samples: ActivitySample[], agentVersion: string): Promise<IngestResult> {
  const url = serverUrl.replace(/\/$/, '') + '/activity/ingest';
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-device-token': token },
      body: JSON.stringify({ agentVersion, samples }),
      signal: AbortSignal.timeout(20000),
    });
    if (res.status === 401) return { ok: false, status: 401, error: 'device token rejected (revoked or unknown)' };
    if (res.status === 403) return { ok: false, status: 403, error: 'monitoring is turned off for this company' };
    if (!res.ok) return { ok: false, status: res.status, error: `server returned ${res.status}` };
    const body = await res.json().catch(() => ({}));
    return { ok: true, status: res.status, accepted: body.accepted };
  } catch (e: any) {
    return { ok: false, status: 0, error: e?.message || 'network error' };
  }
}
