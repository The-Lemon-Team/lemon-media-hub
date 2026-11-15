import { Module } from '@nestjs/common';
import { AiBridgeController } from './ai-bridge.controller';

@Module({
  controllers: [AiBridgeController],
})
export class AiBridgeModule {}
