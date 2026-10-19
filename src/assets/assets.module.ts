import { Module } from '@nestjs/common';
import { StorageModule } from '../storage/storage.module';
import { FoldersModule } from '../folders/folders.module';
import { AssetsService } from './assets.service';
import { AssetsController } from './assets.controller';

@Module({
  imports: [StorageModule, FoldersModule],
  controllers: [AssetsController],
  providers: [AssetsService],
  exports: [AssetsService],
})
export class AssetsModule {}
