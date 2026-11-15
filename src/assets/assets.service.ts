import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AccessPermission,
  MediaKind,
  MediaVisibility,
  Prisma,
  ProcessingStatus,
  VariantType,
} from '@prisma/client';
import { randomUUID } from 'crypto';
import * as fs from 'fs/promises';
import { AuthService } from '../auth/auth.service';
import { MediaCallerContext } from '../auth/auth.types';
import { MediaEventsService } from '../events/media-events.service';
import { FoldersService } from '../folders/folders.service';
import { PrismaService } from '../prisma/prisma.service';
import { ProcessingQueueService } from '../processing/processing-queue.service';
import { StorageService } from '../storage/storage.service';
import { formatAssetRecord, pickMainVariantRoute } from './asset-formatter.util';
import {
  CreateSignedUrlDto,
  QueryAssetsDto,
  UpdateAssetAccessDto,
  UpdateAssetMetadataDto,
} from './assets.dto';

export interface UploadMetadataInput {
  folderPath?: string;
  tags?: string[];
  title?: string;
  description?: string;
  visibility?: MediaVisibility;
  allowedClients?: string[];
  aiRequestId?: string;
  sourceAssetId?: string;
  prompt?: string;
  userPrompt?: string;
  style?: string;
  aspectRatio?: string;
  model?: string;
}

@Injectable()
export class AssetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly foldersService: FoldersService,
    private readonly authService: AuthService,
    private readonly processingQueue: ProcessingQueueService,
    private readonly mediaEvents: MediaEventsService,
  ) {}

  private pickMainVariantRoute(asset: any): string {
    return pickMainVariantRoute(asset);
  }

  formatAsset(asset: any, includeAdminDetails = false) {
    return formatAssetRecord(asset, includeAdminDetails);
  }

  canCallerReadAsset(caller: MediaCallerContext, asset: any): boolean {
    if (caller.type === 'admin') return true;
    if (asset.visibility === MediaVisibility.PUBLIC) return true;
    if (asset.sourceApp === caller.slug) return true;
    if (asset.visibility === MediaVisibility.SCOPED) {
      const now = new Date();
      return (asset.grants || []).some(
        (g: any) => g.clientId === caller.clientId && (!g.expiresAt || g.expiresAt > now),
      );
    }
    return false;
  }

  private assertCallerRead(caller: MediaCallerContext, asset: any) {
    if (!this.canCallerReadAsset(caller, asset)) {
      throw new ForbiddenException(`You do not have access to asset '${asset.id}'`);
    }
  }

  private defaultInclude() {
    return {
      variants: true,
      grants: { include: { client: true } },
      jobs: { orderBy: { createdAt: 'desc' as const }, take: 5 },
    };
  }

  async queryAssets(caller: MediaCallerContext, dto?: QueryAssetsDto) {
    const andConditions: Prisma.MediaAssetWhereInput[] = [];
    const now = new Date();

    if (caller.type === 'client') {
      andConditions.push({
        OR: [
          { visibility: MediaVisibility.PUBLIC },
          { sourceApp: caller.slug },
          {
            AND: [
              { visibility: MediaVisibility.SCOPED },
              {
                grants: {
                  some: {
                    clientId: caller.clientId,
                    OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
                  },
                },
              },
            ],
          },
        ],
      });
    }

    if (dto?.kind) andConditions.push({ kind: dto.kind });
    if (dto?.visibility) andConditions.push({ visibility: dto.visibility });
    if (dto?.processingStatus) andConditions.push({ processingStatus: dto.processingStatus });
    if (dto?.folderId) andConditions.push({ folderId: dto.folderId });
    if (dto?.folderPath && dto.folderPath !== 'all') {
      const clean = dto.folderPath.toLowerCase().replace(/^\/|\/$/g, '');
      andConditions.push({ folderPath: { equals: clean, mode: 'insensitive' } });
    }
    if (dto?.isFavorite !== undefined) andConditions.push({ isFavorite: dto.isFavorite });
    if (dto?.style && dto.style !== 'all') {
      andConditions.push({ style: { equals: dto.style, mode: 'insensitive' } });
    }
    if (dto?.tag) {
      andConditions.push({ tags: { has: dto.tag } });
    }
    if (dto?.search?.trim()) {
      const s = dto.search.trim();
      andConditions.push({
        OR: [
          { filename: { contains: s, mode: 'insensitive' } },
          { title: { contains: s, mode: 'insensitive' } },
          { description: { contains: s, mode: 'insensitive' } },
          { prompt: { contains: s, mode: 'insensitive' } },
          { userPrompt: { contains: s, mode: 'insensitive' } },
          { tags: { has: s } },
        ],
      });
    }

    const where: Prisma.MediaAssetWhereInput =
      andConditions.length > 0 ? { AND: andConditions } : {};

    const offset = Number(dto?.offset) || 0;
    const limit = Math.min(Number(dto?.limit) || 50, 200);

    const [total, rows] = await Promise.all([
      this.prisma.mediaAsset.count({ where }),
      this.prisma.mediaAsset.findMany({
        where,
        include: this.defaultInclude(),
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
      }),
    ]);

    const isAdmin = caller.type === 'admin';
    return {
      items: rows.map((r) => this.formatAsset(r, isAdmin)),
      total,
    };
  }

  async getAssetById(caller: MediaCallerContext, id: string) {
    const asset = await this.prisma.mediaAsset.findUnique({
      where: { id },
      include: this.defaultInclude(),
    });
    if (!asset) return null;
    this.assertCallerRead(caller, asset);
    return this.formatAsset(asset, caller.type === 'admin');
  }

  async getAssetLineage(caller: MediaCallerContext, id: string) {
    const rootRaw = await this.prisma.mediaAsset.findUnique({
      where: { id },
      include: this.defaultInclude(),
    });
    if (!rootRaw) return null;
    this.assertCallerRead(caller, rootRaw);

    const ancestors: any[] = [];
    const visited = new Set<string>([rootRaw.id]);
    let currentParentId = rootRaw.sourceAssetId;

    while (currentParentId && !visited.has(currentParentId)) {
      visited.add(currentParentId);
      const parentAsset = await this.prisma.mediaAsset.findUnique({
        where: { id: currentParentId },
        include: this.defaultInclude(),
      });
      if (!parentAsset || !this.canCallerReadAsset(caller, parentAsset)) break;
      ancestors.unshift(parentAsset);
      currentParentId = parentAsset.sourceAssetId;
    }

    const [childrenRaw, siblingsRaw] = await Promise.all([
      this.prisma.mediaAsset.findMany({
        where: { sourceAssetId: rootRaw.id },
        include: this.defaultInclude(),
        orderBy: { createdAt: 'desc' },
      }),
      rootRaw.sourceAssetId
        ? this.prisma.mediaAsset.findMany({
            where: {
              sourceAssetId: rootRaw.sourceAssetId,
              NOT: { id: rootRaw.id },
            },
            include: this.defaultInclude(),
            orderBy: { createdAt: 'desc' },
          })
        : Promise.resolve([]),
    ]);

    const isAdmin = caller.type === 'admin';
    const parent = ancestors.length > 0 ? ancestors[ancestors.length - 1] : null;
    const rootAsset = ancestors.length > 0 ? ancestors[0] : null;

    return {
      asset: this.formatAsset(rootRaw, isAdmin),
      rootAsset: rootAsset ? this.formatAsset(rootAsset, isAdmin) : null,
      parent: parent ? this.formatAsset(parent, isAdmin) : null,
      ancestors: ancestors.map((a) => this.formatAsset(a, isAdmin)),
      children: childrenRaw
        .filter((a) => this.canCallerReadAsset(caller, a))
        .map((a) => this.formatAsset(a, isAdmin)),
      siblings: siblingsRaw
        .filter((a) => this.canCallerReadAsset(caller, a))
        .map((a) => this.formatAsset(a, isAdmin)),
    };
  }

  async uploadFile(
    caller: MediaCallerContext,
    file: Express.Multer.File,
    input: UploadMetadataInput,
  ) {
    if (!file) {
      throw new BadRequestException('File field is required');
    }

    const assetId = randomUUID();
    const originalName = file.originalname || `upload-${assetId}.bin`;
    const kind = this.storage.detectMediaKind(file.mimetype, originalName);
    const detectedMime =
      file.mimetype && file.mimetype !== 'application/octet-stream'
        ? file.mimetype
        : this.storage.guessMimeType(originalName);

    const savedOriginal = file.path
      ? await this.storage.moveTempToOriginal(file.path, assetId, originalName)
      : await this.storage.saveBufferAsOriginal(file.buffer, assetId, originalName);

    const folderPath = (input.folderPath || (kind === MediaKind.VIDEO ? 'videos' : kind === MediaKind.AUDIO ? 'audio' : 'covers'))
      .trim()
      .replace(/^\/|\/$/g, '');
    const folder = await this.foldersService.getFolderByPath(folderPath);

    let visibility = input.visibility;
    if (!visibility) {
      if (input.allowedClients?.length) {
        visibility = MediaVisibility.SCOPED;
      } else if (folder?.defaultVisibility) {
        visibility = folder.defaultVisibility;
      } else {
        visibility = MediaVisibility.PRIVATE;
      }
    }

    let sourceAssetId = input.sourceAssetId || null;
    if (sourceAssetId) {
      const parentExists = await this.prisma.mediaAsset.findUnique({
        where: { id: sourceAssetId },
        select: { id: true },
      });
      if (!parentExists) sourceAssetId = null;
    }

    const sourceApp = caller.type === 'admin' ? 'admin' : caller.slug;

    let finalMime = detectedMime;
    let finalSize = savedOriginal.sizeBytes;
    let width: number | null = null;
    let height: number | null = null;
    let processingStatus: ProcessingStatus = ProcessingStatus.PENDING;
    let processedAt: Date | null = null;
    const extraVariants: Array<{
      variantType: VariantType;
      storageKey: string;
      mimeType: string;
      sizeBytes: number;
      width: number | null;
      height: number | null;
    }> = [];

    if (kind === MediaKind.IMAGE) {
      const imgResult = await this.storage.processImageFile(
        savedOriginal.absPath,
        assetId,
        originalName,
        detectedMime,
      );
      width = imgResult.width;
      height = imgResult.height;
      finalMime = imgResult.mimeType;
      if (imgResult.variants.length > 0) {
        finalSize = imgResult.sizeBytes;
      }
      extraVariants.push(...imgResult.variants);
      processingStatus = ProcessingStatus.READY;
      processedAt = new Date();
    } else if (kind === MediaKind.DOCUMENT) {
      processingStatus = ProcessingStatus.READY;
      processedAt = new Date();
    }

    const grantClientSlugs = new Set<string>(input.allowedClients || []);
    if (caller.type === 'client' && visibility === MediaVisibility.SCOPED) {
      grantClientSlugs.add(caller.slug);
    }

    const clientsToGrant =
      grantClientSlugs.size > 0
        ? await this.prisma.serviceClient.findMany({
            where: { slug: { in: Array.from(grantClientSlugs) }, isActive: true },
          })
        : [];

    const created = await this.prisma.mediaAsset.create({
      data: {
        id: assetId,
        kind,
        title: input.title || input.userPrompt || originalName,
        description: input.description || null,
        filename: originalName,
        originalFilename: originalName,
        mimeType: finalMime,
        sizeBytes: finalSize,
        width,
        height,
        aspectRatio: input.aspectRatio || '16:9',
        processingStatus,
        processedAt,
        storageKey: savedOriginal.storageKey,
        visibility,
        folderId: folder?.id || null,
        folderPath,
        tags: input.tags || [],
        sourceAssetId,
        sourceApp,
        aiRequestId: input.aiRequestId || null,
        prompt: input.prompt || null,
        userPrompt: input.userPrompt || null,
        style: input.style || null,
        model: input.model || 'manual-upload',
        variants: {
          create: [
            {
              variantType: VariantType.ORIGINAL,
              storageKey: savedOriginal.storageKey,
              mimeType: detectedMime,
              sizeBytes: savedOriginal.sizeBytes,
              width,
              height,
            },
            ...extraVariants.map((v) => ({
              variantType: v.variantType,
              storageKey: v.storageKey,
              mimeType: v.mimeType,
              sizeBytes: v.sizeBytes,
              width: v.width,
              height: v.height,
            })),
          ],
        },
        ...(clientsToGrant.length > 0
          ? {
              grants: {
                create: clientsToGrant.map((c) => ({
                  clientId: c.id,
                  permission: AccessPermission.READ,
                })),
              },
            }
          : {}),
      },
      include: this.defaultInclude(),
    });

    if (kind === MediaKind.VIDEO || kind === MediaKind.AUDIO) {
      await this.processingQueue.enqueueAssetProcessing(created.id, kind);
    }

    const publicFormatted = this.formatAsset(created, false);
    this.mediaEvents.emitAssetEvent('MEDIA_ADDED', created, publicFormatted, {
      sourceApp,
    });

    return this.formatAsset(created, caller.type === 'admin');
  }

  async updateMetadata(id: string, dto: UpdateAssetMetadataDto) {
    const existing = await this.prisma.mediaAsset.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Asset '${id}' not found`);

    let folderId = existing.folderId;
    let folderPath = existing.folderPath;
    if (dto.folderPath !== undefined) {
      const clean = dto.folderPath.trim().replace(/^\/|\/$/g, '');
      const folder = await this.foldersService.getFolderByPath(clean);
      folderId = folder?.id || null;
      folderPath = clean;
    }

    const updated = await this.prisma.mediaAsset.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.folderPath !== undefined ? { folderId, folderPath } : {}),
        ...(dto.tags !== undefined ? { tags: dto.tags } : {}),
      },
      include: this.defaultInclude(),
    });

    this.mediaEvents.emitAssetEvent(
      'MEDIA_UPDATED',
      updated,
      this.formatAsset(updated, false),
      { previousFolderPath: existing.folderPath },
    );

    return this.formatAsset(updated, true);
  }

  async updateAccess(id: string, dto: UpdateAssetAccessDto) {
    const existing = await this.prisma.mediaAsset.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Asset '${id}' not found`);

    const requestedEntries = dto.clients || [];
    const slugs = requestedEntries.map((c) => c.clientSlug.trim().toLowerCase()).filter(Boolean);
    const matchedClients =
      slugs.length > 0
        ? await this.prisma.serviceClient.findMany({ where: { slug: { in: slugs } } })
        : [];
    const bySlug = new Map(matchedClients.map((c) => [c.slug, c]));

    for (const entry of requestedEntries) {
      if (!bySlug.has(entry.clientSlug.trim().toLowerCase())) {
        throw new BadRequestException(`Unknown service client slug '${entry.clientSlug}'`);
      }
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.assetAccessGrant.deleteMany({ where: { assetId: id } });

      if (dto.visibility === MediaVisibility.SCOPED && requestedEntries.length > 0) {
        await tx.assetAccessGrant.createMany({
          data: requestedEntries.map((entry) => {
            const client = bySlug.get(entry.clientSlug.trim().toLowerCase())!;
            return {
              assetId: id,
              clientId: client.id,
              permission: entry.permission || AccessPermission.READ,
              expiresAt: entry.expiresAt ? new Date(entry.expiresAt) : null,
            };
          }),
        });
      }

      return tx.mediaAsset.update({
        where: { id },
        data: { visibility: dto.visibility },
        include: this.defaultInclude(),
      });
    });

    this.mediaEvents.emitAssetEvent(
      'MEDIA_ACCESS_CHANGED',
      updated,
      this.formatAsset(updated, false),
      { previousVisibility: existing.visibility, visibility: dto.visibility },
    );

    return this.formatAsset(updated, true);
  }

  async createSignedUrl(caller: MediaCallerContext, id: string, dto: CreateSignedUrlDto) {
    const asset = await this.prisma.mediaAsset.findUnique({
      where: { id },
      include: this.defaultInclude(),
    });
    if (!asset) throw new NotFoundException(`Asset '${id}' not found`);
    this.assertCallerRead(caller, asset);

    const variant = (dto.variant || this.pickMainVariantRoute(asset)).toLowerCase();
    const ttlSeconds = Math.min(Math.max(dto.ttlSeconds || 3600, 30), 604800);
    const expUnixSec = Math.floor(Date.now() / 1000) + ttlSeconds;
    const clientSlug = caller.type === 'client' ? caller.slug : undefined;

    const sig = this.authService.signMediaUrl({
      assetId: asset.id,
      variant,
      expUnixSec,
      clientSlug,
    });

    const query = new URLSearchParams({
      exp: String(expUnixSec),
      sig,
    });
    if (clientSlug) query.set('client', clientSlug);

    const relativeUrl = `/api/media/${asset.id}/file/${variant}?${query.toString()}`;
    return {
      assetId: asset.id,
      variant,
      relativeUrl,
      expiresAt: new Date(expUnixSec * 1000).toISOString(),
    };
  }

  async toggleFavorite(caller: MediaCallerContext, id: string) {
    const existing = await this.prisma.mediaAsset.findUnique({
      where: { id },
      include: this.defaultInclude(),
    });
    if (!existing) throw new NotFoundException(`Asset '${id}' not found`);
    this.assertCallerRead(caller, existing);

    const updated = await this.prisma.mediaAsset.update({
      where: { id },
      data: { isFavorite: !existing.isFavorite },
      include: this.defaultInclude(),
    });
    this.mediaEvents.emitAssetEvent('MEDIA_FAVORITED', updated, this.formatAsset(updated, false), {
      isFavorite: updated.isFavorite,
    });
    return this.formatAsset(updated, caller.type === 'admin');
  }

  async incrementUsage(caller: MediaCallerContext, id: string) {
    const existing = await this.prisma.mediaAsset.findUnique({
      where: { id },
      include: { grants: true },
    });
    if (!existing) return;
    if (!this.canCallerReadAsset(caller, existing)) return;

    const updated = await this.prisma.mediaAsset.update({
      where: { id },
      data: { usageCount: { increment: 1 } },
      include: this.defaultInclude(),
    });
    this.mediaEvents.emitAssetEvent('MEDIA_VIEWED', updated, this.formatAsset(updated, false), {
      usageCount: updated.usageCount,
      viewer: caller.type === 'admin' ? 'admin' : caller.slug,
    });
  }

  async reprocessAsset(id: string) {
    const asset = await this.prisma.mediaAsset.findUnique({
      where: { id },
      include: this.defaultInclude(),
    });
    if (!asset) throw new NotFoundException(`Asset '${id}' not found`);

    if (asset.kind === MediaKind.IMAGE) {
      const absOriginal = this.storage.resolveStoragePath(asset.storageKey);
      const imgResult = await this.storage.processImageFile(
        absOriginal,
        asset.id,
        asset.originalFilename,
        asset.mimeType,
      );
      for (const v of imgResult.variants) {
        await this.prisma.mediaVariant.upsert({
          where: { assetId_variantType: { assetId: asset.id, variantType: v.variantType } },
          update: {
            storageKey: v.storageKey,
            mimeType: v.mimeType,
            sizeBytes: v.sizeBytes,
            width: v.width,
            height: v.height,
          },
          create: {
            assetId: asset.id,
            variantType: v.variantType,
            storageKey: v.storageKey,
            mimeType: v.mimeType,
            sizeBytes: v.sizeBytes,
            width: v.width,
            height: v.height,
          },
        });
      }
      const updated = await this.prisma.mediaAsset.update({
        where: { id },
        data: {
          width: imgResult.width,
          height: imgResult.height,
          processingStatus: ProcessingStatus.READY,
          processingError: null,
          processedAt: new Date(),
        },
        include: this.defaultInclude(),
      });
      this.mediaEvents.emitAssetEvent('MEDIA_READY', updated, this.formatAsset(updated, false));
      return this.formatAsset(updated, true);
    }

    if (asset.kind === MediaKind.VIDEO || asset.kind === MediaKind.AUDIO) {
      await this.prisma.mediaAsset.update({
        where: { id },
        data: { processingStatus: ProcessingStatus.PENDING, processingError: null },
      });
      await this.processingQueue.enqueueAssetProcessing(asset.id, asset.kind);
      const refreshed = await this.prisma.mediaAsset.findUnique({
        where: { id },
        include: this.defaultInclude(),
      });
      if (refreshed) {
        this.mediaEvents.emitAssetEvent(
          'MEDIA_PROCESSING',
          refreshed,
          this.formatAsset(refreshed, false),
        );
      }
      return this.formatAsset(refreshed, true);
    }

    return this.formatAsset(asset, true);
  }

  async deleteAsset(id: string): Promise<boolean> {
    const existing = await this.prisma.mediaAsset.findUnique({
      where: { id },
      include: { variants: true, grants: true },
    });
    if (!existing) throw new NotFoundException(`Asset '${id}' not found`);

    const keysToDelete = [
      existing.storageKey,
      ...existing.variants.map((v) => v.storageKey),
    ];

    await this.prisma.mediaAsset.delete({ where: { id } });
    await this.storage.deleteStorageKeys(keysToDelete);

    const variantDir = this.storage.resolveStoragePath(`variants/${id}`);
    await fs.rm(variantDir, { recursive: true, force: true }).catch(() => {});

    this.mediaEvents.emitAssetEvent('MEDIA_DELETED', existing, undefined, {
      folderPath: existing.folderPath,
      kind: existing.kind,
    });

    return true;
  }
}
