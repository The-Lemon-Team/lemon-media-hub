import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as fs from 'fs';
import * as path from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('LemonMediaHub');
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  const corsOrigin = process.env.CORS_ORIGIN || '*';
  app.enableCors({
    origin:
      corsOrigin === '*'
        ? true
        : corsOrigin
            .split(',')
            .map((o) => o.trim())
            .filter(Boolean),
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  // Note: /uploads static exposure intentionally removed.
  // All media binaries are delivered via /api/media/:id/file/:variant with access control.

  // Serve built Admin UI
  const adminDir = path.join(process.cwd(), 'dist', 'admin');
  if (fs.existsSync(adminDir)) {
    app.useStaticAssets(adminDir, {
      prefix: '/admin/',
    });
    const expressApp = app.getHttpAdapter().getInstance();
    expressApp.get('/', (_req: any, res: any) => res.redirect('/admin/'));
    expressApp.get('/admin', (_req: any, res: any) => res.redirect('/admin/'));
    expressApp.get('/admin/*', (req: any, res: any, next: any) => {
      if (req.accepts('html')) {
        res.sendFile(path.join(adminDir, 'index.html'));
      } else {
        next();
      }
    });
  }

  const config = new DocumentBuilder()
    .setTitle('Lemon Media Hub API')
    .setDescription(
      'Global Single-Entry Media Storage, Processing (Image/Video/Audio), Signed Delivery, and Multi-App Access Control',
    )
    .setVersion('2.0.0')
    .addBearerAuth()
    .addApiKey({ type: 'apiKey', name: 'X-Media-Api-Key', in: 'header' }, 'x-media-api-key')
    .addTag('Auth')
    .addTag('Assets')
    .addTag('Media Delivery')
    .addTag('Folders')
    .addTag('Clients')
    .addTag('Health')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  const port = Number(process.env.PORT) || 3005;
  await app.listen(port);

  logger.log(`Lemon Media Hub is running at: http://localhost:${port}`);
  logger.log(`OpenAPI / Swagger Docs at: http://localhost:${port}/docs`);
}

bootstrap();
