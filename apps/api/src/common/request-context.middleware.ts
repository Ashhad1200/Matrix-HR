import { randomUUID } from 'crypto';

/**
 * Gives every request an id (honouring a sane inbound X-Request-Id from a load balancer), echoes it in the
 * response, and emits one structured JSON access-log line per request in production — greppable, and the
 * same id appears in error responses and error logs. Query strings are never logged: they can carry tokens.
 */
export function requestContext(req: any, res: any, next: () => void) {
  const incoming = req.headers['x-request-id'];
  const id = typeof incoming === 'string' && /^[\w-]{8,64}$/.test(incoming) ? incoming : randomUUID();
  req.requestId = id;
  res.setHeader('X-Request-Id', id);

  const started = process.hrtime.bigint();
  res.on('finish', () => {
    const path: string = (req.originalUrl || req.url || '').split('?')[0];
    if (path.startsWith('/api/v1/health')) return; // probes would drown everything else
    if (process.env.LOG_FORMAT !== 'json' && process.env.NODE_ENV !== 'production') return;
    const line = {
      level: res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info',
      msg: 'http',
      requestId: id,
      method: req.method,
      path,
      status: res.statusCode,
      ms: Math.round(Number(process.hrtime.bigint() - started) / 1e5) / 10,
      tenantId: req.user?.tenantId,
      userId: req.user?.id,
      ip: req.ip,
    };
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(line));
  });
  next();
}
