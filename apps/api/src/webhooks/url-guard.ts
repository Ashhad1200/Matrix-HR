import { BadRequestException } from '@nestjs/common';
import { lookup } from 'dns/promises';
import { isIP } from 'net';

function ipv4Private(ip: string): boolean {
  const [a, b] = ip.split('.').map(Number);
  return (
    a === 10 || a === 127 || a === 0 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 169 && b === 254) ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 198 && (b === 18 || b === 19))
  );
}

export function isPrivateAddress(ip: string): boolean {
  if (isIP(ip) === 4) return ipv4Private(ip);
  const v6 = ip.toLowerCase();
  if (v6 === '::1' || v6 === '::') return true;
  const mapped = v6.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return ipv4Private(mapped[1]);
  return v6.startsWith('fc') || v6.startsWith('fd') || /^fe[89ab]/.test(v6);
}

/**
 * Tenants choose webhook URLs, so without this a tenant admin could make the API
 * call internal services (Postgres, MinIO, cloud metadata). Set
 * WEBHOOK_ALLOW_PRIVATE_TARGETS=true only for local development.
 * ponytail: resolves DNS here and fetch() resolves again, so a DNS-rebinding host could
 * still slip through; pin the resolved IP with a custom agent if that threat matters.
 */
export async function assertPublicHttpUrl(raw: string): Promise<void> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new BadRequestException('Webhook URL is not a valid URL');
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new BadRequestException('Webhook URL must use http or https');
  }
  if (process.env.WEBHOOK_ALLOW_PRIVATE_TARGETS === 'true') return;

  const host = url.hostname.replace(/^\[|\]$/g, '');
  const addresses = isIP(host) ? [{ address: host }] : await lookup(host, { all: true }).catch(() => []);
  if (addresses.length === 0) throw new BadRequestException('Webhook host could not be resolved');
  if (addresses.some((a) => isPrivateAddress(a.address))) {
    throw new BadRequestException('Webhook URL must point to a public address');
  }
}
