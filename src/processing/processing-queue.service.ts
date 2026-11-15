import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  MediaKind,
  ProcessingJobStatus,
  ProcessingJobType,
  ProcessingStatus,
} from '@prisma/client';
import { formatAssetRecord } from '../assets/asset-formatter.util';
import { MediaEventsService } from '../events/media-events.service';
import { PrismaService } from '../prisma/prisma.service';
import { SavedVariantFile } from '../storage/storage.service';
import { MediaProcessorService } from './media-processor.service';

// pg-boss v9 exports constructor directly in CommonJS
// eslint-disable-next-line @typescript-eslint/no-var-requires
const PgBoss = require('pg-boss');

const QUEUE_VIDEO = 'media-video-process';
const QUEUE_AUDIO = 'media-audio-process';

interface ProcessingPayload {
  assetId: string;
  jobRecordId: string;
}

@Injectable()
export class ProcessingQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ProcessingQueueService.name);
  private boss: any = null;
  private started = false;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly processor: MediaProcessorService,
    private readonly mediaEvents: MediaEventsService,
  ) {}

  async onModuleInit() {
    const dbUrl = this.config.get<string>('DATABASE_URL');
    if (!dbUrl) {
      this.logger.warn('DATABASE_URL missing; pg-boss queue disabled');
      return;
    }

    try {
      this.boss = new PgBoss({
        connectionString: dbUrl,
        schema: 'pgboss',
        monitorStateIntervalSeconds: 30,
      });

      this.boss.on('error', (err: any) => {
        this.logger.error(`pg-boss error: ${err?.message || err}`);
      });

      await this.boss.start();
      await this.boss.work(
        QUEUE_VIDEO,
        { teamSize: 2, teamConcurrency: 1 },
        async (job: { data: ProcessingPayload }) => this.handleVideoJob(job.data),
      );
      await this.boss.work(
        QUEUE_AUDIO,
        { teamSize: 2, teamConcurrency: 1 },
        async (job: { data: ProcessingPayload }) => this.handleAudioJob(job.data),
      );

      this.started = true;
      this.logger.log('pg-boss media processing worker started (queues: video, audio)');
    } catch (err: any) {
      this.logger.error(`Failed to start pg-boss worker: ${err.message}`);
    }
  }

  async onModuleDestroy() {
    if (this.boss && this.started) {
      await this.boss.stop({ graceful: true, timeout: 5000 }).catch(() => {});
    }
  }

  isReady(): boolean {
    return this.started;
  }

  async enqueueAssetProcessing(assetId: string, kind: MediaKind): Promise<void> {
    if (kind !== MediaKind.VIDEO && kind !== MediaKind.AUDIO) {
      return;
    }

    const jobType =
      kind === MediaKind.VIDEO
        ? ProcessingJobType.VIDEO_TRANSCODE
        : ProcessingJobType.AUDIO_PROCESS;

    const jobRecord = await this.prisma.mediaProcessingJob.create({
      data: {
        assetId,
        jobType,
        status: ProcessingJobStatus.PENDING,
      },
    });

    const queueName = kind === MediaKind.VIDEO ? QUEUE_VIDEO : QUEUE_AUDIO;
    const payload: ProcessingPayload = { assetId, jobRecordId: jobRecord.id };

    if (this.boss && this.started) {
      await this.boss.send(queueName, payload, { retryLimit: 2, retryDelay: 5 });
    } else {
      // Fallback inline async execution if pg-boss isn't started
      setImmediate(() => {
        if (kind === MediaKind.VIDEO) {
          void this.handleVideoJob(payload);
        } else {
          void this.handleAudioJob(payload);
        }
      });
    }
  }

  private async upsertVariants(assetId: string, durationMs: number | null, variants: SavedVariantFile[]) {
    for (const v of variants) {
      await this.prisma.mediaVariant.upsert({
        where: {
          assetId_variantType: { assetId, variantType: v.variantType },
        },
        update: {
          storageKey: v.storageKey,
          mimeType: v.mimeType,
          sizeBytes: v.sizeBytes,
          width: v.width,
          height: v.height,
          durationMs,
        },
        create: {
          assetId,
          variantType: v.variantType,
          storageKey: v.storageKey,
          mimeType: v.mimeType,
          sizeBytes: v.sizeBytes,
          width: v.width,
          height: v.height,
          durationMs,
        },
      });
    }
  }

  private async emitProcessedEvent(
    type: 'MEDIA_PROCESSING' | 'MEDIA_READY' | 'MEDIA_FAILED',
    assetId: string,
    extraPayload?: Record<string, any>,
  ) {
    const fresh = await this.prisma.mediaAsset.findUnique({
      where: { id: assetId },
      include: { variants: true, grants: { include: { client: true } } },
    });
    if (!fresh) return;
    this.mediaEvents.emitAssetEvent(type, fresh, formatAssetRecord(fresh, false), extraPayload);
  }

  private async handleVideoJob(payload: ProcessingPayload) {
    const asset = await this.prisma.mediaAsset.findUnique({ where: { id: payload.assetId } });
    if (!asset) return;

    await this.prisma.$transaction([
      this.prisma.mediaAsset.update({
        where: { id: asset.id },
        data: { processingStatus: ProcessingStatus.PROCESSING, processingError: null },
      }),
      this.prisma.mediaProcessingJob.update({
        where: { id: payload.jobRecordId },
        data: {
          status: ProcessingJobStatus.PROCESSING,
          startedAt: new Date(),
          attempts: { increment: 1 },
        },
      }),
    ]);
    await this.emitProcessedEvent('MEDIA_PROCESSING', asset.id, { jobId: payload.jobRecordId });

    try {
      const result = await this.processor.processVideo(asset.id, asset.storageKey);
      await this.upsertVariants(asset.id, result.durationMs, result.variants);

      await this.prisma.$transaction([
        this.prisma.mediaAsset.update({
          where: { id: asset.id },
          data: {
            width: result.width,
            height: result.height,
            aspectRatio: result.aspectRatio,
            durationMs: result.durationMs,
            codec: result.codec,
            bitrate: result.bitrate,
            processingStatus: ProcessingStatus.READY,
            processingError: null,
            processedAt: new Date(),
          },
        }),
        this.prisma.mediaProcessingJob.update({
          where: { id: payload.jobRecordId },
          data: {
            status: ProcessingJobStatus.COMPLETED,
            finishedAt: new Date(),
            error: null,
          },
        }),
      ]);
      await this.emitProcessedEvent('MEDIA_READY', asset.id, {
        jobId: payload.jobRecordId,
        variantsCount: result.variants.length,
      });
      this.logger.log(`Video processed cleanly for asset ${asset.id} (${result.variants.length} variants)`);
    } catch (err: any) {
      this.logger.error(`Video processing failed for asset ${asset.id}: ${err.message}`);
      await this.prisma.$transaction([
        this.prisma.mediaAsset.update({
          where: { id: asset.id },
          data: {
            processingStatus: ProcessingStatus.FAILED,
            processingError: err.message,
          },
        }),
        this.prisma.mediaProcessingJob.update({
          where: { id: payload.jobRecordId },
          data: {
            status: ProcessingJobStatus.FAILED,
            finishedAt: new Date(),
            error: err.message,
          },
        }),
      ]);
      await this.emitProcessedEvent('MEDIA_FAILED', asset.id, {
        jobId: payload.jobRecordId,
        error: err.message,
      });
    }
  }

  private async handleAudioJob(payload: ProcessingPayload) {
    const asset = await this.prisma.mediaAsset.findUnique({ where: { id: payload.assetId } });
    if (!asset) return;

    await this.prisma.$transaction([
      this.prisma.mediaAsset.update({
        where: { id: asset.id },
        data: { processingStatus: ProcessingStatus.PROCESSING, processingError: null },
      }),
      this.prisma.mediaProcessingJob.update({
        where: { id: payload.jobRecordId },
        data: {
          status: ProcessingJobStatus.PROCESSING,
          startedAt: new Date(),
          attempts: { increment: 1 },
        },
      }),
    ]);
    await this.emitProcessedEvent('MEDIA_PROCESSING', asset.id, { jobId: payload.jobRecordId });

    try {
      const result = await this.processor.processAudio(asset.id, asset.storageKey);
      await this.upsertVariants(asset.id, result.durationMs, result.variants);

      await this.prisma.$transaction([
        this.prisma.mediaAsset.update({
          where: { id: asset.id },
          data: {
            durationMs: result.durationMs,
            codec: result.codec,
            bitrate: result.bitrate,
            sampleRate: result.sampleRate,
            channels: result.channels,
            waveformPeaks: result.waveformPeaks,
            processingStatus: ProcessingStatus.READY,
            processingError: null,
            processedAt: new Date(),
          },
        }),
        this.prisma.mediaProcessingJob.update({
          where: { id: payload.jobRecordId },
          data: {
            status: ProcessingJobStatus.COMPLETED,
            finishedAt: new Date(),
            error: null,
          },
        }),
      ]);
      await this.emitProcessedEvent('MEDIA_READY', asset.id, {
        jobId: payload.jobRecordId,
        waveformPeaks: result.waveformPeaks.length,
      });
      this.logger.log(`Audio processed cleanly for asset ${asset.id} (${result.waveformPeaks.length} peaks)`);
    } catch (err: any) {
      this.logger.error(`Audio processing failed for asset ${asset.id}: ${err.message}`);
      await this.prisma.$transaction([
        this.prisma.mediaAsset.update({
          where: { id: asset.id },
          data: {
            processingStatus: ProcessingStatus.FAILED,
            processingError: err.message,
          },
        }),
        this.prisma.mediaProcessingJob.update({
          where: { id: payload.jobRecordId },
          data: {
            status: ProcessingJobStatus.FAILED,
            finishedAt: new Date(),
            error: err.message,
          },
        }),
      ]);
      await this.emitProcessedEvent('MEDIA_FAILED', asset.id, {
        jobId: payload.jobRecordId,
        error: err.message,
      });
    }
  }
}
