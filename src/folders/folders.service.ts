import { Injectable, Logger, OnModuleInit, NotFoundException, BadRequestException } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import { randomUUID } from 'crypto';

export interface MediaFolder {
  id: string;
  name: string;
  path: string; // e.g. "covers/2026"
  parentId?: string | null;
  color?: string;
  icon?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateFolderDto {
  name: string;
  path?: string;
  parentId?: string | null;
  color?: string;
  icon?: string;
}

const DEFAULT_FOLDERS: Omit<MediaFolder, 'id' | 'createdAt' | 'updatedAt'>[] = [
  { name: 'Обложки заметок', path: 'covers', icon: 'sparkles', color: '#f59e0b' },
  { name: 'События 2026', path: 'events-2026', icon: 'calendar', color: '#38bdf8' },
  { name: 'Темы и арты', path: 'themes', icon: 'palette', color: '#a855f7' },
  { name: 'Ремиксы и вариации', path: 'remixes', icon: 'layers', color: '#10b981' },
  { name: 'Архив', path: 'archive', icon: 'archive', color: '#64748b' },
];

@Injectable()
export class FoldersService implements OnModuleInit {
  private readonly logger = new Logger(FoldersService.name);
  private readonly indexPath = path.join(process.cwd(), 'uploads', 'folders-index.json');
  private folders: MediaFolder[] = [];
  private isLoaded = false;

  async onModuleInit() {
    await this.loadIndex();
  }

  private async loadIndex() {
    try {
      const data = await fs.readFile(this.indexPath, 'utf-8');
      this.folders = JSON.parse(data);
      this.logger.log(`📁 Folders index loaded with ${this.folders.length} folders.`);
    } catch {
      // Seed default folders
      const now = new Date().toISOString();
      this.folders = DEFAULT_FOLDERS.map((f) => ({
        ...f,
        id: randomUUID(),
        createdAt: now,
        updatedAt: now,
      }));
      await this.saveIndex();
      this.logger.log(`📁 Initialized default folders index.`);
    } finally {
      this.isLoaded = true;
    }
  }

  private async saveIndex() {
    try {
      await fs.mkdir(path.dirname(this.indexPath), { recursive: true });
      await fs.writeFile(this.indexPath, JSON.stringify(this.folders, null, 2), 'utf-8');
    } catch (err: any) {
      this.logger.error(`Failed to save folders index: ${err.message}`);
    }
  }

  async getAllFolders(): Promise<MediaFolder[]> {
    if (!this.isLoaded) await this.loadIndex();
    return [...this.folders];
  }

  async getFolderById(id: string): Promise<MediaFolder | null> {
    if (!this.isLoaded) await this.loadIndex();
    return this.folders.find((f) => f.id === id) || null;
  }

  async getFolderByPath(folderPath: string): Promise<MediaFolder | null> {
    if (!this.isLoaded) await this.loadIndex();
    const clean = folderPath.trim().replace(/^\/|\/$/g, '');
    return this.folders.find((f) => f.path.toLowerCase() === clean.toLowerCase()) || null;
  }

  async createFolder(dto: CreateFolderDto): Promise<MediaFolder> {
    if (!this.isLoaded) await this.loadIndex();

    const cleanPath = (dto.path || dto.name.toLowerCase().replace(/[^a-z0-9-_]/gi, '-')).replace(/^\/|\/$/g, '');

    const exists = this.folders.some((f) => f.path.toLowerCase() === cleanPath.toLowerCase());
    if (exists) {
      throw new BadRequestException(`Folder with path '${cleanPath}' already exists`);
    }

    const now = new Date().toISOString();
    const newFolder: MediaFolder = {
      id: randomUUID(),
      name: dto.name.trim(),
      path: cleanPath,
      parentId: dto.parentId || null,
      color: dto.color || '#3b82f6',
      icon: dto.icon || 'folder',
      createdAt: now,
      updatedAt: now,
    };

    this.folders.push(newFolder);
    await this.saveIndex();
    return newFolder;
  }

  async deleteFolder(id: string): Promise<boolean> {
    if (!this.isLoaded) await this.loadIndex();
    const idx = this.folders.findIndex((f) => f.id === id);
    if (idx === -1) {
      throw new NotFoundException(`Folder '${id}' not found`);
    }

    this.folders.splice(idx, 1);
    await this.saveIndex();
    return true;
  }
}
