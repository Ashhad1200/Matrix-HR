import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@matrixhr/database';

function databaseUrl(): string {
  const url = process.env.DATABASE_URL ?? '';
  if (!url || url.includes('pgbouncer=true')) return url;
  // Prisma Dev local proxy does not need pgbouncer mode.
  if (/:5121\d\b/.test(url)) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}pgbouncer=true`;
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super({
      datasources: { db: { url: databaseUrl() } },
      log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    });
  }

  async onModuleInit() {
    const maxAttempts = 20;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        await this.$connect();
        // #region agent log
        fetch('http://127.0.0.1:7483/ingest/b4385a4b-295d-4a65-b54c-a91d76c58e74',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'317bd7'},body:JSON.stringify({sessionId:'317bd7',runId:'test-run',hypothesisId:'B',location:'prisma.service.ts:connect-ok',message:'Prisma connected',data:{attempt},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
        return;
      } catch (err) {
        // #region agent log
        const e = err as { code?: string; message?: string };
        fetch('http://127.0.0.1:7483/ingest/b4385a4b-295d-4a65-b54c-a91d76c58e74',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'317bd7'},body:JSON.stringify({sessionId:'317bd7',runId:'test-run',hypothesisId:'B',location:'prisma.service.ts:connect-retry',message:'Prisma connect failed',data:{attempt,maxAttempts,code:e?.code,error:e?.message?.slice(0,120)},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
        if (attempt === maxAttempts) throw err;
        await new Promise((r) => setTimeout(r, Math.min(attempt * 1500, 10000)));
      }
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
