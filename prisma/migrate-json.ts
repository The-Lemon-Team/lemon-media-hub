import * as fs from 'fs/promises';
import * as path from 'path';
import {
  MediaKind,
  MediaVisibility,
  PrismaClient,
  ProcessingStatus,
  VariantType,
} from '@prisma/client';

const prisma = new PrismaClient();

interface LegacyFolder {
  id: string;
  name: string;
  path: string;
  parentId?: string | null;
  icon?: string;
  color?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface LegacyAsset {
  id: string;
  url: string;
  thumbnailUrl?: string;
  filename: string;
  folderId?: string;
  folderPath?: string;
  prompt?: string;
  userPrompt?: string;
  style?: string;
  aspectRatio?: string;
  model?: string;
  sourceAssetId?: string | null;
  width?: number | null;
  height?: number | null;
  sizeBytes?: number;
  mimeType?: string;
  tags?: string[];
  isFavorite?: boolean;
  usageCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

function toStorageKey(relativeUrl: string | undefined): string {
  if (!relativeUrl) return '';
  return relativeUrl.replace(/^\/+/, '').replace(/^uploads\//, '');
}

async function readJsonSafe<T>(filePath: string): Promise<T[]> {
  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function main() {
  const uploadsRoot = path.resolve(process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads'));
  const foldersFile = path.join(uploadsRoot, 'folders-index.json');
  const assetsFile = path.join(uploadsRoot, 'media-index.json');

  const legacyFolders = await readJsonSafe<LegacyFolder>(foldersFile);
  const legacyAssets = await readJsonSafe<LegacyAsset>(assetsFile);

  console.log(`Found ${legacyFolders.length} legacy folders and ${legacyAssets.length} legacy assets.`);

  const folderByPath = new Map<string, string>();

  for (const lf of legacyFolders) {
    const existingByPath = await prisma.mediaFolder.findUnique({ where: { path: lf.path } });
    if (existingByPath && existingByPath.id !== lf.id) {
      // Preserve existing DB ID if seeded earlier under different UUID, or remap assets by path
      folderByPath.set(lf.path, existingByPath.id);
      continue;
    }

    const folder = await prisma.mediaFolder.upsert({
      where: { id: lf.id },
      update: {
        name: lf.name,
        path: lf.path,
        icon: lf.icon || 'folder',
        color: lf.color || '#3b82f6',
      },
      create: {
        id: lf.id,
        name: lf.name,
        path: lf.path,
        icon: lf.icon || 'folder',
        color: lf.color || '#3b82f6',
        defaultVisibility: MediaVisibility.PRIVATE,
        createdAt: lf.createdAt ? new Date(lf.createdAt) : new Date(),
        updatedAt: lf.updatedAt ? new Date(lf.updatedAt) : new Date(),
      },
    });
    folderByPath.set(folder.path, folder.id);
  }

  // First pass: upsert assets without sourceAssetId so parent FK never fails on ordering
  let migratedCount = 0;
  for (const la of legacyAssets) {
    const folderPath = (la.folderPath || 'covers').replace(/^\/|\/$/g, '');
    const resolvedFolderId = folderByPath.get(folderPath) || la.folderId || null;
    const storageKey = toStorageKey(la.url);
    const thumbKey = toStorageKey(la.thumbnailUrl);
    const mimeType = la.mimeType || 'image/webp';
    const sizeBytes = typeof la.sizeBytes === 'number' ? la.sizeBytes : 0;

    await prisma.mediaAsset.upsert({
      where: { id: la.id },
      update: {
        folderId: resolvedFolderId,
        folderPath,
      },
      create: {
        id: la.id,
        kind: MediaKind.IMAGE,
        title: la.userPrompt || la.filename,
        filename: la.filename,
        originalFilename: la.filename,
        mimeType,
        sizeBytes,
        width: la.width ?? null,
        height: la.height ?? null,
        aspectRatio: la.aspectRatio || '16:9',
        processingStatus: ProcessingStatus.READY,
        processedAt: la.updatedAt ? new Date(la.updatedAt) : new Date(),
        storageKey,
        visibility: MediaVisibility.PRIVATE,
        folderId: resolvedFolderId,
        folderPath,
        tags: la.tags || [],
        isFavorite: Boolean(la.isFavorite),
        usageCount: la.usageCount || 0,
        sourceApp: 'legacy-json',
        prompt: la.prompt ?? null,
        userPrompt: la.userPrompt ?? null,
        style: la.style ?? null,
        model: la.model || 'flux',
        createdAt: la.createdAt ? new Date(la.createdAt) : new Date(),
        updatedAt: la.updatedAt ? new Date(la.updatedAt) : new Date(),
      },
    });

    if (storageKey) {
      const mainVariantType =
        mimeType === 'image/svg+xml' ? VariantType.ORIGINAL : VariantType.FULL_WEBP;
      await prisma.mediaVariant.upsert({
        where: {
          assetId_variantType: { assetId: la.id, variantType: mainVariantType },
        },
        update: {
          storageKey,
          mimeType,
          sizeBytes,
          width: la.width ?? null,
          height: la.height ?? null,
        },
        create: {
          assetId: la.id,
          variantType: mainVariantType,
          storageKey,
          mimeType,
          sizeBytes,
          width: la.width ?? null,
          height: la.height ?? null,
        },
      });
    }

    if (thumbKey && thumbKey !== storageKey) {
      let thumbSize = sizeBytes;
      try {
        const st = await fs.stat(path.join(uploadsRoot, thumbKey));
        thumbSize = st.size;
      } catch {
        // Keep estimated size if thumb missing on disk
      }

      await prisma.mediaVariant.upsert({
        where: {
          assetId_variantType: { assetId: la.id, variantType: VariantType.THUMB_360 },
        },
        update: {
          storageKey: thumbKey,
          mimeType: 'image/webp',
          sizeBytes: thumbSize,
        },
        create: {
          assetId: la.id,
          variantType: VariantType.THUMB_360,
          storageKey: thumbKey,
          mimeType: 'image/webp',
          sizeBytes: thumbSize,
        },
      });
    }

    migratedCount++;
  }

  // Second pass: link sourceAssetId lineage
  const existingIds = new Set(legacyAssets.map((a) => a.id));
  let lineageLinked = 0;
  for (const la of legacyAssets) {
    if (la.sourceAssetId && existingIds.has(la.sourceAssetId)) {
      await prisma.mediaAsset.update({
        where: { id: la.id },
        data: { sourceAssetId: la.sourceAssetId },
      });
      lineageLinked++;
    }
  }

  console.log(`JSON -> PostgreSQL migration completed: ${migratedCount} assets, ${lineageLinked} lineage links.`);
}

main()
  .catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
