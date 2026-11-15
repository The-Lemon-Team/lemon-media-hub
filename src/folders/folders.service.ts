import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { MediaVisibility } from '@prisma/client';
import { MediaEventsService } from '../events/media-events.service';
import { PrismaService } from '../prisma/prisma.service';

export interface MediaFolderDto {
  id: string;
  name: string;
  path: string;
  parentId?: string | null;
  icon?: string | null;
  color?: string | null;
  defaultVisibility: MediaVisibility;
  assetsCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateFolderInput {
  name: string;
  path?: string;
  parentId?: string | null;
  icon?: string;
  color?: string;
  defaultVisibility?: MediaVisibility;
}

@Injectable()
export class FoldersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mediaEvents: MediaEventsService,
  ) {}

  private toDto(row: any): MediaFolderDto {
    return {
      id: row.id,
      name: row.name,
      path: row.path,
      parentId: row.parentId,
      icon: row.icon,
      color: row.color,
      defaultVisibility: row.defaultVisibility,
      assetsCount: row._count?.assets,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async getAllFolders(): Promise<MediaFolderDto[]> {
    const rows = await this.prisma.mediaFolder.findMany({
      orderBy: [{ createdAt: 'asc' }],
      include: { _count: { select: { assets: true } } },
    });
    return rows.map((r) => this.toDto(r));
  }

  async getFolderById(id: string): Promise<MediaFolderDto | null> {
    const row = await this.prisma.mediaFolder.findUnique({
      where: { id },
      include: { _count: { select: { assets: true } } },
    });
    return row ? this.toDto(row) : null;
  }

  async getFolderByPath(folderPath: string): Promise<MediaFolderDto | null> {
    const clean = folderPath.trim().replace(/^\/|\/$/g, '');
    const row = await this.prisma.mediaFolder.findFirst({
      where: { path: { equals: clean, mode: 'insensitive' } },
      include: { _count: { select: { assets: true } } },
    });
    return row ? this.toDto(row) : null;
  }

  async createFolder(dto: CreateFolderInput): Promise<MediaFolderDto> {
    const cleanPath = (
      dto.path || dto.name.toLowerCase().replace(/[^a-z0-9-_]/gi, '-')
    )
      .trim()
      .replace(/^\/|\/$/g, '');

    if (!cleanPath) {
      throw new BadRequestException('Folder path cannot be empty');
    }

    const exists = await this.getFolderByPath(cleanPath);
    if (exists) {
      throw new BadRequestException(`Folder with path '${cleanPath}' already exists`);
    }

    const created = await this.prisma.mediaFolder.create({
      data: {
        name: dto.name.trim(),
        path: cleanPath,
        parentId: dto.parentId || null,
        icon: dto.icon || 'folder',
        color: dto.color || '#3b82f6',
        defaultVisibility: dto.defaultVisibility || MediaVisibility.PRIVATE,
      },
      include: { _count: { select: { assets: true } } },
    });

    const dtoResult = this.toDto(created);
    this.mediaEvents.emitFolderEvent('FOLDER_CREATED', dtoResult);
    return dtoResult;
  }

  async deleteFolder(id: string): Promise<boolean> {
    const existing = await this.prisma.mediaFolder.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Folder '${id}' not found`);
    }
    const dtoResult = this.toDto(existing);
    await this.prisma.mediaFolder.delete({ where: { id } });
    this.mediaEvents.emitFolderEvent('FOLDER_DELETED', dtoResult);
    return true;
  }
}
