import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import { randomUUID } from 'crypto';
import * as sharpPkg from 'sharp';

const sharp: any = (sharpPkg as any).default || sharpPkg;

export interface ProcessedMediaFile {
  url: string;
  thumbnailUrl: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
}

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  readonly uploadsRoot = path.join(process.cwd(), 'uploads');
  readonly mediaDir = path.join(this.uploadsRoot, 'media');
  readonly thumbsDir = path.join(this.uploadsRoot, 'thumbs');

  async onModuleInit() {
    await this.ensureDirectories();
  }

  async ensureDirectories() {
    try {
      await fs.mkdir(this.mediaDir, { recursive: true });
      await fs.mkdir(this.thumbsDir, { recursive: true });
      this.logger.log(`📁 Local storage directories ready at: ${this.uploadsRoot}`);
    } catch (err: any) {
      this.logger.error('Failed to create upload directories', err);
    }
  }

  /**
   * Optimizes an image buffer into WebP, extracts dimensions, and generates a fast thumbnail.
   */
  async processAndSaveBuffer(
    buffer: Buffer,
    originalName = 'image.webp',
    isSvg = false,
  ): Promise<ProcessedMediaFile> {
    await this.ensureDirectories();
    const fileId = `${Date.now()}-${randomUUID()}`;

    if (isSvg || originalName.endsWith('.svg')) {
      const filename = `${fileId}.svg`;
      const filePath = path.join(this.mediaDir, filename);
      await fs.writeFile(filePath, buffer);

      return {
        url: `/uploads/media/${filename}`,
        thumbnailUrl: `/uploads/media/${filename}`,
        filename: originalName,
        mimeType: 'image/svg+xml',
        sizeBytes: buffer.length,
        width: 1280,
        height: 720,
      };
    }

    try {
      const sharpInstance = sharp(buffer).rotate();
      const metadata = await sharpInstance.metadata();

      // 1. Full size WebP (quality 90)
      const optimized = await sharpInstance.webp({ quality: 90, effort: 4 }).toBuffer();
      const filename = `${fileId}.webp`;
      await fs.writeFile(path.join(this.mediaDir, filename), optimized);

      // 2. Fast thumbnail (360px width)
      const thumb = await sharp(buffer)
        .rotate()
        .resize({ width: 360, withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer();
      const thumbFilename = `${fileId}-thumb.webp`;
      await fs.writeFile(path.join(this.thumbsDir, thumbFilename), thumb);

      return {
        url: `/uploads/media/${filename}`,
        thumbnailUrl: `/uploads/thumbs/${thumbFilename}`,
        filename: originalName.endsWith('.webp') ? originalName : `${path.parse(originalName).name}.webp`,
        mimeType: 'image/webp',
        sizeBytes: optimized.length,
        width: metadata.width || null,
        height: metadata.height || null,
      };
    } catch {
      // Fallback: save raw buffer directly
      const ext = path.extname(originalName) || '.bin';
      const filename = `${fileId}${ext}`;
      await fs.writeFile(path.join(this.mediaDir, filename), buffer);

      return {
        url: `/uploads/media/${filename}`,
        thumbnailUrl: `/uploads/media/${filename}`,
        filename: originalName,
        mimeType: 'application/octet-stream',
        sizeBytes: buffer.length,
        width: null,
        height: null,
      };
    }
  }

  async deleteFile(url: string, thumbnailUrl?: string) {
    try {
      if (url) {
        const filePath = path.join(process.cwd(), url.replace(/^\//, ''));
        await fs.unlink(filePath).catch(() => {});
      }
      if (thumbnailUrl && thumbnailUrl !== url) {
        const thumbPath = path.join(process.cwd(), thumbnailUrl.replace(/^\//, ''));
        await fs.unlink(thumbPath).catch(() => {});
      }
    } catch (err: any) {
      this.logger.warn(`Failed to delete file from disk: ${err.message}`);
    }
  }

  async getBufferFromUrl(url: string): Promise<{ buffer: Buffer; mimeType: string } | null> {
    try {
      const cleanPath = url.replace(/^\//, '');
      const filePath = path.join(process.cwd(), cleanPath);
      const buffer = await fs.readFile(filePath);
      const ext = path.extname(cleanPath).toLowerCase();
      let mimeType = 'image/webp';
      if (ext === '.svg') mimeType = 'image/svg+xml';
      else if (ext === '.png') mimeType = 'image/png';
      else if (ext === '.jpg' || ext === '.jpeg') mimeType = 'image/jpeg';
      return { buffer, mimeType };
    } catch {
      return null;
    }
  }
}
