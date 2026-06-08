import 'reflect-metadata';
import { config as loadEnv } from 'dotenv';
import { resolve } from 'path';
import { NestFactory } from '@nestjs/core';

loadEnv({ path: resolve(__dirname, '../../../.env') });
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  // #region agent log
  const dbUrl = process.env.DATABASE_URL ?? '';
  const dbHost = dbUrl.match(/@([^:/]+):(\d+)/);
  fetch('http://127.0.0.1:7483/ingest/b4385a4b-295d-4a65-b54c-a91d76c58e74',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'317bd7'},body:JSON.stringify({sessionId:'317bd7',runId:'test-run',hypothesisId:'A,C',location:'main.ts:bootstrap-start',message:'API bootstrap starting',data:{port:process.env.PORT||3001,dbHost:dbHost?.[1],dbPort:dbHost?.[2],hasDbUrl:!!dbUrl},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  const app = await NestFactory.create(AppModule);

  app.use(helmet());
  app.enableCors({
    origin: process.env.WEB_URL || 'http://localhost:3000',
    credentials: true,
  });
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const port = process.env.PORT || 3001;
  try {
    await app.listen(port);
    // #region agent log
    fetch('http://127.0.0.1:7483/ingest/b4385a4b-295d-4a65-b54c-a91d76c58e74',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'317bd7'},body:JSON.stringify({sessionId:'317bd7',runId:'test-run',hypothesisId:'A',location:'main.ts:listen-ok',message:'API listening',data:{port},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    console.log(`MatrixHR API running on http://localhost:${port}`);
  } catch (err: unknown) {
    // #region agent log
    const e = err as { code?: string; message?: string };
    fetch('http://127.0.0.1:7483/ingest/b4385a4b-295d-4a65-b54c-a91d76c58e74',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'317bd7'},body:JSON.stringify({sessionId:'317bd7',runId:'test-run',hypothesisId:'A',location:'main.ts:listen-fail',message:'API listen failed',data:{port,code:e?.code,error:e?.message?.slice(0,120)},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    throw err;
  }
}

bootstrap().catch((err: unknown) => {
  // #region agent log
  const e = err as { code?: string; message?: string };
  fetch('http://127.0.0.1:7483/ingest/b4385a4b-295d-4a65-b54c-a91d76c58e74',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'317bd7'},body:JSON.stringify({sessionId:'317bd7',runId:'test-run',hypothesisId:'B',location:'main.ts:bootstrap-fail',message:'Bootstrap failed',data:{code:e?.code,error:e?.message?.slice(0,200)},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  throw err;
});
