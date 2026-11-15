import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import { diskStorage } from 'multer';
import * as path from 'path';
import { FoldersModule } from '../folders/folders.module';
import { ProcessingModule } from '../processing/processing.module';
import { StorageModule } from '../storage/storage.module';
import { AssetsController } from './assets.controller';
import { AssetsService } from './assets.service';
import { MediaDeliveryController } from './media-delivery.controller';

@Module({
  imports: [
    StorageModule,
    FoldersModule,
    ProcessingModule,
    MulterModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const uploadsRoot = path.resolve(
          config.get<string>('UPLOAD_DIR') || path.join(process.cwd(), 'uploads'),
        );
        const tmpDir = path.join(uploadsRoot, 'tmp');
        fs.mkdirSync(tmpDir, { recursive: true });

        const maxBytes =
          Number(config.get<string>('MAX_UPLOAD_BYTES')) || 500 * 1024 * 1024;

        return {
          storage: diskStorage({
            destination: tmpDir,
            filename: (_req, file, cb) => {
              const ext = path.extname(file.originalname || '').slice(0, 12);
              cb(null, `${Date.now()}-${randomUUID()}${ext}`);
            },
          }),
          limits: {
            fileSize: maxBytes,
          },
        };
      },
    }),
  ],
  controllers: [AssetsController, MediaDeliveryController],
  providers: [AssetsService],
  exports: [AssetsService],
})
export class AssetsModule {}
