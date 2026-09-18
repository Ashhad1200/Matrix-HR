import 'reflect-metadata';
import { config as loadEnv } from 'dotenv';
import { resolve } from 'path';
import { NestFactory } from '@nestjs/core';

loadEnv({ path: resolve(__dirname, '../../../.env') });
import { RequestMethod, ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(helmet());
  app.enableCors({
    origin: process.env.WEB_URL || 'http://localhost:3000',
    credentials: true,
  });
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

  const port = process.env.PORT || 3001;
  await app.listen(port);
  console.log(`MatrixHR API running on http://localhost:${port}`);
  console.log(`API docs at http://localhost:${port}/api/docs`);
}

bootstrap().catch((err) => {
  console.error('Fatal error during API bootstrap:', err);
  process.exit(1);
});
