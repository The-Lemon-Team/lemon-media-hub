import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { VariantType } from '@prisma/client';
import { spawn } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import { SavedVariantFile, StorageService } from '../storage/storage.service';

export interface VideoProcessOutput {
  width: number | null;
  height: number | null;
  aspectRatio: string;
  durationMs: number | null;
  codec: string | null;
  bitrate: number | null;
  variants: SavedVariantFile[];
}

export interface AudioProcessOutput {
  durationMs: number | null;
  codec: string | null;
  bitrate: number | null;
  sampleRate: number | null;
  channels: number | null;
  waveformPeaks: number[];
  variants: SavedVariantFile[];
}

@Injectable()
export class MediaProcessorService {
  private readonly logger = new Logger(MediaProcessorService.name);
  private readonly ffmpegPath?: string;
  private readonly ffprobePath?: string;

  constructor(
    private readonly config: ConfigService,
    private readonly storage: StorageService,
  ) {
    this.ffmpegPath = this.resolveBinary(
      this.config.get<string>('FFMPEG_PATH'),
      () => require('ffmpeg-static'),
    );
    this.ffprobePath = this.resolveBinary(
      this.config.get<string>('FFPROBE_PATH'),
      () => require('ffprobe-static')?.path,
    );

    this.logger.log(
      `Media binaries: ffmpeg=${this.ffmpegPath || 'MISSING'}, ffprobe=${this.ffprobePath || 'MISSING'}`,
    );
  }

  private resolveBinary(envValue: string | undefined, pkgLoader: () => string | undefined): string | undefined {
    const trimmed = envValue?.trim();
    if (trimmed) return trimmed;
    try {
      const pkgPath = pkgLoader();
      if (pkgPath) return pkgPath;
    } catch {
      // Package optional or missing
    }
    return undefined;
  }

  isFfmpegAvailable(): boolean {
    return Boolean(this.ffmpegPath && this.ffprobePath);
  }

  private execBinary(
    bin: string,
    args: string[],
    timeoutMs = 120_000,
    collectStdoutBinary = false,
  ): Promise<{ stdout: Buffer; stderr: string }> {
    return new Promise((resolve, reject) => {
      const child = spawn(bin, args, { stdio: ['ignore', 'pipe', 'pipe'] });
      const stdoutChunks: Buffer[] = [];
      const stderrChunks: Buffer[] = [];
      let timedOut = false;

      const timer = setTimeout(() => {
        timedOut = true;
        child.kill('SIGKILL');
        reject(new Error(`Binary ${path.basename(bin)} timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      child.stdout.on('data', (chunk: Buffer) => {
        stdoutChunks.push(chunk);
      });
      child.stderr.on('data', (chunk: Buffer) => {
        if (!collectStdoutBinary || stderrChunks.length < 32) {
          stderrChunks.push(chunk);
        }
      });

      child.on('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });

      child.on('close', (code) => {
        clearTimeout(timer);
        if (timedOut) return;
        const stderr = Buffer.concat(stderrChunks).toString('utf-8');
        if (code !== 0) {
          reject(new Error(`${path.basename(bin)} exited with code ${code}: ${stderr.slice(-500)}`));
          return;
        }
        resolve({ stdout: Buffer.concat(stdoutChunks), stderr });
      });
    });
  }

  async probeFile(absPath: string): Promise<any> {
    if (!this.ffprobePath) {
      throw new Error('ffprobe binary is not configured');
    }
    const { stdout } = await this.execBinary(
      this.ffprobePath,
      ['-v', 'quiet', '-print_format', 'json', '-show_format', '-show_streams', absPath],
      30_000,
    );
    return JSON.parse(stdout.toString('utf-8'));
  }

  private formatAspectRatio(width: number | null, height: number | null): string {
    if (!width || !height) return '16:9';
    const ratio = width / height;
    if (Math.abs(ratio - 16 / 9) < 0.12) return '16:9';
    if (Math.abs(ratio - 9 / 16) < 0.12) return '9:16';
    if (Math.abs(ratio - 4 / 3) < 0.12) return '4:3';
    if (Math.abs(ratio - 3 / 4) < 0.12) return '3:4';
    if (Math.abs(ratio - 1) < 0.1) return '1:1';
    return `${width}:${height}`;
  }

  async processVideo(assetId: string, originalStorageKey: string): Promise<VideoProcessOutput> {
    if (!this.ffmpegPath || !this.ffprobePath) {
      throw new Error('ffmpeg/ffprobe unavailable');
    }

    const inputPath = this.storage.resolveStoragePath(originalStorageKey);
    const probe = await this.probeFile(inputPath);
    const videoStream = (probe.streams || []).find((s: any) => s.codec_type === 'video');
    const format = probe.format || {};

    const width = videoStream?.width ? Number(videoStream.width) : null;
    const height = videoStream?.height ? Number(videoStream.height) : null;
    const durationSec = Number(format.duration || videoStream?.duration || 0);
    const durationMs = Number.isFinite(durationSec) && durationSec > 0 ? Math.round(durationSec * 1000) : null;
    const bitrate = format.bit_rate ? Number(format.bit_rate) : null;
    const codec = videoStream?.codec_name || null;

    const variantDir = await this.storage.ensureAssetVariantDir(assetId);
    const variants: SavedVariantFile[] = [];

    // 1. Extract poster JPG near 10% or 1s mark
    const seekSec = durationSec > 2 ? Math.min(2, Math.floor(durationSec * 0.1)) : 0;
    const posterPath = path.join(variantDir, `${assetId}-poster.jpg`);
    await this.execBinary(
      this.ffmpegPath,
      [
        '-y',
        '-ss',
        String(seekSec),
        '-i',
        inputPath,
        '-frames:v',
        '1',
        '-q:v',
        '2',
        posterPath,
      ],
      45_000,
    );

    const posterStat = await fs.stat(posterPath);
    variants.push({
      variantType: VariantType.POSTER_JPG,
      storageKey: this.storage.toStorageKey(posterPath),
      mimeType: 'image/jpeg',
      sizeBytes: posterStat.size,
      width,
      height,
    });

    // 2. Build fast WebP thumbnail from poster
    const thumbVariant = await this.storage.generateThumbnailFromImageFile(posterPath, assetId);
    if (thumbVariant) {
      variants.push(thumbVariant);
    }

    // 3. Transcode web-ready H.264 + AAC 720p MP4 with faststart for streaming & Range seeking
    const mp4Path = path.join(variantDir, `${assetId}-720p.mp4`);
    await this.execBinary(
      this.ffmpegPath,
      [
        '-y',
        '-i',
        inputPath,
        '-vf',
        "scale='min(1280,iw)':-2",
        '-c:v',
        'libx264',
        '-preset',
        'veryfast',
        '-crf',
        '23',
        '-pix_fmt',
        'yuv420p',
        '-c:a',
        'aac',
        '-b:a',
        '128k',
        '-movflags',
        '+faststart',
        mp4Path,
      ],
      600_000,
    );

    const mp4Stat = await fs.stat(mp4Path);
    const mp4Probe = await this.probeFile(mp4Path).catch(() => null);
    const mp4Stream = (mp4Probe?.streams || []).find((s: any) => s.codec_type === 'video');

    variants.push({
      variantType: VariantType.MP4_720P,
      storageKey: this.storage.toStorageKey(mp4Path),
      mimeType: 'video/mp4',
      sizeBytes: mp4Stat.size,
      width: mp4Stream?.width ? Number(mp4Stream.width) : width,
      height: mp4Stream?.height ? Number(mp4Stream.height) : height,
    });

    return {
      width,
      height,
      aspectRatio: this.formatAspectRatio(width, height),
      durationMs,
      codec,
      bitrate,
      variants,
    };
  }

  async processAudio(assetId: string, originalStorageKey: string): Promise<AudioProcessOutput> {
    if (!this.ffmpegPath || !this.ffprobePath) {
      throw new Error('ffmpeg/ffprobe unavailable');
    }

    const inputPath = this.storage.resolveStoragePath(originalStorageKey);
    const probe = await this.probeFile(inputPath);
    const audioStream = (probe.streams || []).find((s: any) => s.codec_type === 'audio');
    const format = probe.format || {};

    const durationSec = Number(format.duration || audioStream?.duration || 0);
    const durationMs = Number.isFinite(durationSec) && durationSec > 0 ? Math.round(durationSec * 1000) : null;
    const bitrate = audioStream?.bit_rate
      ? Number(audioStream.bit_rate)
      : format.bit_rate
        ? Number(format.bit_rate)
        : null;
    const sampleRate = audioStream?.sample_rate ? Number(audioStream.sample_rate) : null;
    const channels = audioStream?.channels ? Number(audioStream.channels) : null;
    const codec = audioStream?.codec_name || null;

    const variantDir = await this.storage.ensureAssetVariantDir(assetId);
    const variants: SavedVariantFile[] = [];

    // 1. Transcode/normalize to web-friendly MP3 192k
    const mp3Path = path.join(variantDir, `${assetId}.mp3`);
    await this.execBinary(
      this.ffmpegPath,
      ['-y', '-i', inputPath, '-vn', '-c:a', 'libmp3lame', '-b:a', '192k', mp3Path],
      300_000,
    );
    const mp3Stat = await fs.stat(mp3Path);
    variants.push({
      variantType: VariantType.AUDIO_MP3,
      storageKey: this.storage.toStorageKey(mp3Path),
      mimeType: 'audio/mpeg',
      sizeBytes: mp3Stat.size,
      width: null,
      height: null,
    });

    // 2. Compute 64 normalized waveform amplitude peaks (0..100) from mono 8kHz PCM
    const waveformPeaks = await this.computeWaveformPeaks(inputPath, 64);

    return {
      durationMs,
      codec,
      bitrate,
      sampleRate,
      channels,
      waveformPeaks,
      variants,
    };
  }

  private async computeWaveformPeaks(inputPath: string, buckets = 64): Promise<number[]> {
    if (!this.ffmpegPath) return [];
    try {
      const { stdout } = await this.execBinary(
        this.ffmpegPath,
        ['-v', 'error', '-i', inputPath, '-ac', '1', '-ar', '8000', '-f', 's16le', 'pipe:1'],
        60_000,
        true,
      );

      const sampleCount = Math.floor(stdout.length / 2);
      if (sampleCount <= 0) return Array(buckets).fill(0);

      const step = Math.max(1, Math.floor(sampleCount / buckets));
      const rawPeaks: number[] = [];
      let globalMax = 1;

      for (let b = 0; b < buckets; b++) {
        const start = b * step;
        const end = b === buckets - 1 ? sampleCount : Math.min(sampleCount, start + step);
        let maxAbs = 0;
        for (let i = start; i < end; i++) {
          const val = Math.abs(stdout.readInt16LE(i * 2));
          if (val > maxAbs) maxAbs = val;
        }
        rawPeaks.push(maxAbs);
        if (maxAbs > globalMax) globalMax = maxAbs;
      }

      return rawPeaks.map((p) => Math.max(4, Math.min(100, Math.round((p / globalMax) * 100))));
    } catch (err: any) {
      this.logger.warn(`Waveform extraction fallback: ${err.message}`);
      return [];
    }
  }
}
