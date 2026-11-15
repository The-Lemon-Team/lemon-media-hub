import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AiBridgeModule } from './ai-bridge/ai-bridge.module';
import { AssetsModule } from './assets/assets.module';
import { AuthModule } from './auth/auth.module';
import { ClientsModule } from './clients/clients.module';
import { MediaEventsModule } from './events/media-events.module';
import { FoldersModule } from './folders/folders.module';
import { HealthController } from './health/health.controller';
import { PrismaModule } from './prisma/prisma.module';
import { ProcessingModule } from './processing/processing.module';
import { StorageModule } from './storage/storage.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '.env.local'],
    }),
    PrismaModule,
    AuthModule,
    MediaEventsModule,
    StorageModule,
    ProcessingModule,
    FoldersModule,
    ClientsModule,
    AssetsModule,
    AiBridgeModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
