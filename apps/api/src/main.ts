import 'reflect-metadata';
import { config as loadEnv } from 'dotenv';
import { resolve } from 'path';
import { NestFactory } from '@nestjs/core';

loadEnv({ path: resolve(__dirname, '../../../.env') });
import { RequestMethod, ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/http-exception.filter';
import { requestContext } from './common/request-context.middleware';
import { assertProductionConfig } from './common/production-config';

async function bootstrap() {
  assertProductionConfig();
  // rawBody: the WhatsApp webhook's HMAC signature is computed over the exact bytes Meta sent.
  const app = await NestFactory.create(AppModule, { rawBody: true });

  // Behind a load balancer the client IP arrives in X-Forwarded-For; without this every request looks like
  // the proxy's IP and the per-IP rate limits would throttle (or spare) everyone at once. TRUST_PROXY is a
  // hop count ("1"), "true", or a subnet list — set it to match your topology.
  if (process.env.TRUST_PROXY) {
    const tp = process.env.TRUST_PROXY;
    app.getHttpAdapter().getInstance().set('trust proxy', /^\d+$/.test(tp) ? Number(tp) : tp === 'true' ? true : tp);
  }
  app.use(requestContext);
  app.use(helmet());
  // CORS is an allow-list of our own web origin(s) (WEB_URL, comma-separated), never "*". The localhost
  // fallback only exists outside production; production refuses to boot without a real WEB_URL.
  app.enableCors({
    origin: (process.env.WEB_URL || 'http://localhost:3000').split(',').map((o) => o.trim()),
    credentials: true,
  });
  app.useGlobalFilters(new AllExceptionsFilter());
  // ZKTeco terminals have /iclock/* hard-coded, so those routes live outside the /api/v1 prefix.
  app.setGlobalPrefix('api/v1', { exclude: [{ path: 'iclock/(.*)', method: RequestMethod.ALL }] });
  // Terminals POST text/plain (or an arbitrary content-type); capture it raw before the JSON parsers run.
  app.use('/iclock', (req: any, _res: any, next: () => void) => {
    if (req.method !== 'POST') return next();
    let data = '';
    req.setEncoding('utf8');
    req.on('data', (chunk: string) => {
      data += chunk;
      if (data.length > 2_000_000) req.destroy();
    });
    req.on('end', () => {
      req.rawText = data;
      req._body = true;
      req.body = {};
      next();
    });
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // The interactive API docs enumerate every route, so they are off in production unless explicitly enabled.
  if (process.env.NODE_ENV !== 'production' || process.env.ENABLE_API_DOCS === 'true') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('MatrixHR API')
      .setDescription('Public REST API for the MatrixHR platform. Authenticate with a Bearer JWT from /auth/login.')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document, {
      customSiteTitle: 'MatrixHR API Docs',
      jsonDocumentUrl: 'api/docs-json',
    });
  }

  const port = process.env.PORT || 3001;
  await app.listen(port);
  console.log(`MatrixHR API running on http://localhost:${port}`);
  if (process.env.NODE_ENV !== 'production' || process.env.ENABLE_API_DOCS === 'true') console.log(`API docs at http://localhost:${port}/api/docs`);
}

bootstrap().catch((err) => {
  console.error('Fatal error during API bootstrap:', err);
  process.exit(1);
});
