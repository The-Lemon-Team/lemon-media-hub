import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { StorageModule } from './storage/storage.module';
import { FoldersModule } from './folders/folders.module';
import { AssetsModule } from './assets/assets.module';
import { AiModule } from './ai/ai.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '.env.local'],
    }),
    StorageModule,
    FoldersModule,
    AssetsModule,
    AiModule,
  ],
})
export class AppModule {}
