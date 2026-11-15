import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PublicRoute } from '../auth/auth.decorators';
import { PrismaService } from '../prisma/prisma.service';
import { MediaProcessorService } from '../processing/media-processor.service';
import { ProcessingQueueService } from '../processing/processing-queue.service';

@ApiTags('Health')
@Controller('api/health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly processor: MediaProcessorService,
    private readonly queue: ProcessingQueueService,
  ) {}

  @Get()
  @PublicRoute()
  @ApiOperation({ summary: 'Health & subsystem readiness check' })
  async getHealth() {
    let dbOk = false;
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      dbOk = true;
    } catch {
      dbOk = false;
    }

    return {
      status: dbOk ? 'ok' : 'degraded',
      service: 'lemon-media-hub',
      database: dbOk ? 'connected' : 'disconnected',
      queueReady: this.queue.isReady(),
      ffmpegAvailable: this.processor.isFfmpegAvailable(),
      timestamp: new Date().toISOString(),
    };
  }
}
