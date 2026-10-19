import { Injectable, Logger, OnModuleInit, NotFoundException } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { StorageService } from '../storage/storage.service';
import { FoldersService } from '../folders/folders.service';

export interface MediaAsset {
  id: string;
  url: string;
  thumbnailUrl: string;
  filename: string;
  folderId?: string;
  folderPath: string; // e.g. "covers" or "events-2026"
  prompt?: string;
  userPrompt?: string;
  style?: string;
  aspectRatio: string;
  model: string;
  sourceAssetId?: string | null; // ID of parent image if generated via remix
  width: number | null;
  height: number | null;
  sizeBytes: number;
  mimeType: string;
  tags: string[];
  isFavorite: boolean;
  usageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface QueryAssetsDto {
  folderId?: string;
  folderPath?: string;
  search?: string;
  style?: string;
  tag?: string;
  isFavorite?: boolean;
  limit?: number;
  offset?: number;
}

@Injectable()
export class AssetsService implements OnModuleInit {
  private readonly logger = new Logger(AssetsService.name);
  private readonly indexPath = path.join(process.cwd(), 'uploads', 'media-index.json');
  private assets: MediaAsset[] = [];
  private isLoaded = false;

  constructor(
    private readonly storageService: StorageService,
    private readonly foldersService: FoldersService,
  ) {}

  async onModuleInit() {
    await this.loadIndex();
  }

  private async loadIndex() {
    try {
      const data = await fs.readFile(this.indexPath, 'utf-8');
      this.assets = JSON.parse(data);
      this.logger.log(`📚 Media Assets index loaded with ${this.assets.length} items.`);
    } catch {
      this.assets = [];
      await this.saveIndex();
      this.logger.log('📁 Created new media assets index.');
    } finally {
      this.isLoaded = true;
    }
  }

  private async saveIndex() {
    try {
      await fs.mkdir(path.dirname(this.indexPath), { recursive: true });
      await fs.writeFile(this.indexPath, JSON.stringify(this.assets, null, 2), 'utf-8');
    } catch (err: any) {
      this.logger.error(`Failed to save media index: ${err.message}`);
    }
  }

  async queryAssets(dto?: QueryAssetsDto): Promise<{ items: MediaAsset[]; total: number }> {
    if (!this.isLoaded) await this.loadIndex();

    let filtered = [...this.assets];

    if (dto?.folderId) {
      filtered = filtered.filter((a) => a.folderId === dto.folderId);
    }

    if (dto?.folderPath) {
      const clean = dto.folderPath.toLowerCase().replace(/^\/|\/$/g, '');
      filtered = filtered.filter((a) => a.folderPath.toLowerCase() === clean);
    }

    if (dto?.isFavorite !== undefined) {
      filtered = filtered.filter((a) => a.isFavorite === dto.isFavorite);
    }

    if (dto?.style) {
      filtered = filtered.filter((a) => a.style?.toLowerCase() === dto.style?.toLowerCase());
    }

    if (dto?.tag) {
      filtered = filtered.filter((a) => a.tags.some((t) => t.toLowerCase() === dto.tag?.toLowerCase()));
    }

    if (dto?.search && dto.search.trim()) {
      const s = dto.search.toLowerCase();
      filtered = filtered.filter(
        (a) =>
          a.filename.toLowerCase().includes(s) ||
          (a.prompt && a.prompt.toLowerCase().includes(s)) ||
          (a.userPrompt && a.userPrompt.toLowerCase().includes(s)) ||
          a.tags.some((t) => t.toLowerCase().includes(s)),
      );
    }

    const total = filtered.length;
    const offset = Number(dto?.offset) || 0;
    const limit = Number(dto?.limit) || 50;
    const items = filtered.slice(offset, offset + limit);

    return { items, total };
  }

  async getAssetById(id: string): Promise<MediaAsset | null> {
    if (!this.isLoaded) await this.loadIndex();
    return this.assets.find((a) => a.id === id) || null;
  }

  async saveAsset(
    data: Omit<MediaAsset, 'id' | 'createdAt' | 'updatedAt' | 'usageCount' | 'isFavorite'> & {
      isFavorite?: boolean;
    },
  ): Promise<MediaAsset> {
    if (!this.isLoaded) await this.loadIndex();

    const now = new Date().toISOString();
    const asset: MediaAsset = {
      id: randomUUID(),
      url: data.url,
      thumbnailUrl: data.thumbnailUrl,
      filename: data.filename,
      folderId: data.folderId,
      folderPath: data.folderPath || 'covers',
      prompt: data.prompt,
      userPrompt: data.userPrompt,
      style: data.style,
      aspectRatio: data.aspectRatio || '16:9',
      model: data.model || 'imagen-3.0',
      sourceAssetId: data.sourceAssetId || null,
      width: data.width,
      height: data.height,
      sizeBytes: data.sizeBytes,
      mimeType: data.mimeType,
      tags: data.tags || [],
      isFavorite: Boolean(data.isFavorite),
      usageCount: 0,
      createdAt: now,
      updatedAt: now,
    };

    this.assets.unshift(asset);
    await this.saveIndex();
    return asset;
  }

  async toggleFavorite(id: string): Promise<MediaAsset> {
    if (!this.isLoaded) await this.loadIndex();
    const asset = this.assets.find((a) => a.id === id);
    if (!asset) {
      throw new NotFoundException(`Asset '${id}' not found`);
    }
    asset.isFavorite = !asset.isFavorite;
    asset.updatedAt = new Date().toISOString();
    await this.saveIndex();
    return asset;
  }

  async incrementUsage(idOrUrl: string): Promise<void> {
    if (!this.isLoaded) await this.loadIndex();
    const asset = this.assets.find((a) => a.id === idOrUrl || a.url === idOrUrl);
    if (asset) {
      asset.usageCount = (asset.usageCount || 0) + 1;
      asset.updatedAt = new Date().toISOString();
      await this.saveIndex();
    }
  }

  async deleteAsset(id: string): Promise<boolean> {
    if (!this.isLoaded) await this.loadIndex();
    const idx = this.assets.findIndex((a) => a.id === id);
    if (idx === -1) {
      throw new NotFoundException(`Asset '${id}' not found`);
    }

    const asset = this.assets[idx];
    this.assets.splice(idx, 1);
    await this.saveIndex();

    await this.storageService.deleteFile(asset.url, asset.thumbnailUrl);
    return true;
  }

  async uploadManualFile(file: Express.Multer.File, folderPath = 'covers', tags: string[] = []): Promise<MediaAsset> {
    const processed = await this.storageService.processAndSaveBuffer(file.buffer, file.originalname);
    const folder = await this.foldersService.getFolderByPath(folderPath);

    return this.saveAsset({
      url: processed.url,
      thumbnailUrl: processed.thumbnailUrl,
      filename: processed.filename,
      folderId: folder?.id,
      folderPath,
      aspectRatio: '16:9',
      model: 'manual-upload',
      width: processed.width,
      height: processed.height,
      sizeBytes: processed.sizeBytes,
      mimeType: processed.mimeType,
      tags,
    });
  }
}
