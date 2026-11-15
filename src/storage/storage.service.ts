import { BadRequestException, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MediaKind, VariantType } from '@prisma/client';
import { randomUUID } from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as sharpPkg from 'sharp';

const sharp: any = (sharpPkg as any).default || sharpPkg;

export interface SavedVariantFile {
  variantType: VariantType;
  storageKey: string;
  mimeType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
}

export interface ImageProcessingResult {
  width: number | null;
  height: number | null;
  mimeType: string;
  sizeBytes: number;
  variants: SavedVariantFile[];
}

const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg', '.avif', '.bmp', '.tiff']);
const VIDEO_EXTS = new Set(['.mp4', '.webm', '.mov', '.mkv', '.avi', '.m4v']);
const AUDIO_EXTS = new Set(['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac', '.opus']);

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  readonly uploadsRoot: string;
  readonly tmpDir: string;
  readonly originalsDir: string;
  readonly variantsDir: string;

  constructor(private readonly config: ConfigService) {
    this.uploadsRoot = path.resolve(
      this.config.get<string>('UPLOAD_DIR') || path.join(process.cwd(), 'uploads'),
    );
    this.tmpDir = path.join(this.uploadsRoot, 'tmp');
    this.originalsDir = path.join(this.uploadsRoot, 'originals');
    this.variantsDir = path.join(this.uploadsRoot, 'variants');
  }

  async onModuleInit() {
    await this.ensureDirectories();
  }

  async ensureDirectories() {
    await fs.mkdir(this.uploadsRoot, { recursive: true });
    await fs.mkdir(this.tmpDir, { recursive: true });
    await fs.mkdir(this.originalsDir, { recursive: true });
    await fs.mkdir(this.variantsDir, { recursive: true });
    this.logger.log(`Local disk storage ready at: ${this.uploadsRoot}`);
  }

  resolveStoragePath(storageKey: string): string {
    const clean = storageKey.replace(/\\/g, '/').replace(/^\/+/, '');
    const resolved = path.resolve(this.uploadsRoot, clean);
    if (resolved !== this.uploadsRoot && !resolved.startsWith(this.uploadsRoot + path.sep)) {
      throw new BadRequestException('Invalid storage key path');
    }
    return resolved;
  }

  toStorageKey(absPath: string): string {
    const rel = path.relative(this.uploadsRoot, absPath).replace(/\\/g, '/');
    if (rel.startsWith('..') || path.isAbsolute(rel)) {
      throw new BadRequestException('Path escapes uploads root');
    }
    return rel;
  }

  detectMediaKind(mimeType: string | undefined, originalName: string): MediaKind {
    const mime = (mimeType || '').toLowerCase();
    const ext = path.extname(originalName || '').toLowerCase();

    if (mime.startsWith('image/') || IMAGE_EXTS.has(ext)) return MediaKind.IMAGE;
    if (mime.startsWith('video/') || VIDEO_EXTS.has(ext)) return MediaKind.VIDEO;
    if (mime.startsWith('audio/') || AUDIO_EXTS.has(ext)) return MediaKind.AUDIO;
    return MediaKind.DOCUMENT;
  }

  guessMimeType(filename: string, fallback = 'application/octet-stream'): string {
    const ext = path.extname(filename).toLowerCase();
    const map: Record<string, string> = {
      '.webp': 'image/webp',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
      '.avif': 'image/avif',
      '.mp4': 'video/mp4',
      '.webm': 'video/webm',
      '.mov': 'video/quicktime',
      '.mkv': 'video/x-matroska',
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav',
      '.ogg': 'audio/ogg',
      '.m4a': 'audio/mp4',
      '.aac': 'audio/aac',
      '.flac': 'audio/flac',
      '.opus': 'audio/opus',
      '.pdf': 'application/pdf',
    };
    return map[ext] || fallback;
  }

  async ensureAssetVariantDir(assetId: string): Promise<string> {
    const dir = path.join(this.variantsDir, assetId);
    await fs.mkdir(dir, { recursive: true });
    return dir;
  }

  async moveTempToOriginal(
    tmpPath: string,
    assetId: string,
    originalName: string,
  ): Promise<{ storageKey: string; absPath: string; sizeBytes: number; ext: string }> {
    await this.ensureDirectories();
    const now = new Date();
    const monthFolder = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
    const destDir = path.join(this.originalsDir, monthFolder);
    await fs.mkdir(destDir, { recursive: true });

    const ext = path.extname(originalName) || '.bin';
    const destPath = path.join(destDir, `${assetId}-original${ext}`);

    try {
      await fs.rename(tmpPath, destPath);
    } catch {
      await fs.copyFile(tmpPath, destPath);
      await fs.unlink(tmpPath).catch(() => {});
    }

    const stat = await fs.stat(destPath);
    return {
      storageKey: this.toStorageKey(destPath),
      absPath: destPath,
      sizeBytes: stat.size,
      ext,
    };
  }

  async saveBufferAsOriginal(
    buffer: Buffer,
    assetId: string,
    originalName: string,
  ): Promise<{ storageKey: string; absPath: string; sizeBytes: number }> {
    await this.ensureDirectories();
    const tmpPath = path.join(this.tmpDir, `${randomUUID()}${path.extname(originalName) || '.bin'}`);
    await fs.writeFile(tmpPath, buffer);
    return this.moveTempToOriginal(tmpPath, assetId, originalName);
  }

  async processImageFile(
    sourcePath: string,
    assetId: string,
    originalName: string,
    mimeType: string,
  ): Promise<ImageProcessingResult> {
    const buffer = await fs.readFile(sourcePath);
    const isSvg = mimeType === 'image/svg+xml' || originalName.toLowerCase().endsWith('.svg');

    if (isSvg) {
      return {
        width: 1280,
        height: 720,
        mimeType: 'image/svg+xml',
        sizeBytes: buffer.length,
        variants: [],
      };
    }

    const variantDir = await this.ensureAssetVariantDir(assetId);
    const variants: SavedVariantFile[] = [];

    try {
      const baseSharp = sharp(buffer).rotate();
      const metadata = await baseSharp.metadata();

      const optimized = await sharp(buffer).rotate().webp({ quality: 90, effort: 4 }).toBuffer();
      const fullPath = path.join(variantDir, `${assetId}.webp`);
      await fs.writeFile(fullPath, optimized);

      variants.push({
        variantType: VariantType.FULL_WEBP,
        storageKey: this.toStorageKey(fullPath),
        mimeType: 'image/webp',
        sizeBytes: optimized.length,
        width: metadata.width || null,
        height: metadata.height || null,
      });

      const thumb = await sharp(buffer)
        .rotate()
        .resize({ width: 360, withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer();
      const thumbMeta = await sharp(thumb).metadata();
      const thumbPath = path.join(variantDir, `${assetId}-thumb.webp`);
      await fs.writeFile(thumbPath, thumb);

      variants.push({
        variantType: VariantType.THUMB_360,
        storageKey: this.toStorageKey(thumbPath),
        mimeType: 'image/webp',
        sizeBytes: thumb.length,
        width: thumbMeta.width || 360,
        height: thumbMeta.height || null,
      });

      return {
        width: metadata.width || null,
        height: metadata.height || null,
        mimeType: 'image/webp',
        sizeBytes: optimized.length,
        variants,
      };
    } catch (err: any) {
      this.logger.warn(`Sharp optimization fallback for ${originalName}: ${err.message}`);
      return {
        width: null,
        height: null,
        mimeType: mimeType || this.guessMimeType(originalName),
        sizeBytes: buffer.length,
        variants: [],
      };
    }
  }

  async generateThumbnailFromImageFile(
    imagePath: string,
    assetId: string,
  ): Promise<SavedVariantFile | null> {
    try {
      const variantDir = await this.ensureAssetVariantDir(assetId);
      const thumb = await sharp(imagePath)
        .rotate()
        .resize({ width: 360, withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer();
      const thumbMeta = await sharp(thumb).metadata();
      const thumbPath = path.join(variantDir, `${assetId}-thumb.webp`);
      await fs.writeFile(thumbPath, thumb);

      return {
        variantType: VariantType.THUMB_360,
        storageKey: this.toStorageKey(thumbPath),
        mimeType: 'image/webp',
        sizeBytes: thumb.length,
        width: thumbMeta.width || 360,
        height: thumbMeta.height || null,
      };
    } catch (err: any) {
      this.logger.warn(`Failed to generate thumbnail from ${imagePath}: ${err.message}`);
      return null;
    }
  }

  async deleteStorageKeys(storageKeys: string[]) {
    const unique = Array.from(new Set(storageKeys.filter(Boolean)));
    for (const key of unique) {
      try {
        const absPath = this.resolveStoragePath(key);
        await fs.unlink(absPath).catch(() => {});
      } catch {
        // Ignore invalid paths on cleanup
      }
    }
  }
}
