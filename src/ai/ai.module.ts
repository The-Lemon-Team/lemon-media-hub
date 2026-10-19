import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { StorageModule } from '../storage/storage.module';
import { AssetsModule } from '../assets/assets.module';
import { FoldersModule } from '../folders/folders.module';
import { GeminiTextService } from './gemini-text.service';
import { ImagenService } from './imagen.service';
import { AiController } from './ai.controller';

@Module({
  imports: [ConfigModule, StorageModule, AssetsModule, FoldersModule],
  controllers: [AiController],
  providers: [GeminiTextService, ImagenService],
  exports: [GeminiTextService, ImagenService],
})
export class AiModule {}
