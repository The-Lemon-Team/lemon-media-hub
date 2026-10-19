import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { Logger } from '@nestjs/common';
import * as path from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('LemonMediaHub');
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Enable CORS for frontend clients (admin-cms, calendar apps, etc.)
  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: false,
  });

  // Serve static assets from /uploads directory
  const uploadsDir = path.join(process.cwd(), 'uploads');
  app.useStaticAssets(uploadsDir, {
    prefix: '/uploads/',
  });

  // Swagger OpenAPI documentation
  const config = new DocumentBuilder()
    .setTitle('Lemon Media Hub API')
    .setDescription(
      'Standalone AI & Media Asset Hub — Image Generation (Imagen 3), Image-to-Image Remixing, Markdown Note AI, and DAM Folder Storage',
    )
    .setVersion('1.0.0')
    .addTag('AI Engine')
    .addTag('Assets')
    .addTag('Folders')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  const port = Number(process.env.PORT) || 3005;
  await app.listen(port);

  logger.log(`🚀 Lemon Media Hub is running at: http://localhost:${port}`);
  logger.log(`📚 OpenAPI / Swagger Docs at: http://localhost:${port}/docs`);
  logger.log(`📂 Static Assets served at: http://localhost:${port}/uploads/`);
}

bootstrap();
