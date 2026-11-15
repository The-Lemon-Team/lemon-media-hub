import { VariantType } from '@prisma/client';

export function variantEnumToSlug(vt: VariantType): string {
  switch (vt) {
    case VariantType.ORIGINAL:
      return 'original';
    case VariantType.FULL_WEBP:
      return 'full';
    case VariantType.THUMB_360:
      return 'thumb';
    case VariantType.POSTER_JPG:
      return 'poster';
    case VariantType.MP4_720P:
      return 'mp4_720p';
    case VariantType.AUDIO_MP3:
      return 'audio_mp3';
    default:
      return 'original';
  }
}

export function pickMainVariantRoute(asset: any): string {
  const types = new Set((asset.variants || []).map((v: any) => v.variantType));
  if (asset.kind === 'VIDEO' && types.has(VariantType.MP4_720P)) {
    return 'mp4_720p';
  }
  if (asset.kind === 'AUDIO' && types.has(VariantType.AUDIO_MP3)) {
    return 'audio_mp3';
  }
  if (asset.kind === 'IMAGE' && types.has(VariantType.FULL_WEBP)) {
    return 'full';
  }
  return 'original';
}

export function pickThumbUrl(asset: any): string | null {
  const types = new Set((asset.variants || []).map((v: any) => v.variantType));
  if (types.has(VariantType.THUMB_360)) {
    return `/api/media/${asset.id}/file/thumb`;
  }
  if (types.has(VariantType.POSTER_JPG)) {
    return `/api/media/${asset.id}/file/poster`;
  }
  if (asset.kind === 'IMAGE') {
    return `/api/media/${asset.id}/file/${pickMainVariantRoute(asset)}`;
  }
  return null;
}

export function formatAssetRecord(asset: any, includeAdminDetails = false): Record<string, any> {
  const mainVariant = pickMainVariantRoute(asset);
  const base: Record<string, any> = {
    id: asset.id,
    kind: asset.kind,
    title: asset.title,
    description: asset.description,
    url: `/api/media/${asset.id}/file/${mainVariant}`,
    thumbnailUrl: pickThumbUrl(asset) || `/api/media/${asset.id}/file/${mainVariant}`,
    filename: asset.filename,
    originalFilename: asset.originalFilename,
    folderId: asset.folderId,
    folderPath: asset.folderPath,
    mimeType: asset.mimeType,
    sizeBytes: asset.sizeBytes,
    width: asset.width,
    height: asset.height,
    aspectRatio: asset.aspectRatio,
    durationMs: asset.durationMs,
    codec: asset.codec,
    bitrate: asset.bitrate,
    sampleRate: asset.sampleRate,
    channels: asset.channels,
    waveformPeaks: asset.waveformPeaks,
    processingStatus: asset.processingStatus,
    processingError: asset.processingError,
    processedAt: asset.processedAt ? new Date(asset.processedAt).toISOString() : null,
    visibility: asset.visibility,
    tags: asset.tags || [],
    isFavorite: asset.isFavorite,
    usageCount: asset.usageCount,
    sourceAssetId: asset.sourceAssetId,
    sourceApp: asset.sourceApp,
    aiRequestId: asset.aiRequestId,
    prompt: asset.prompt,
    userPrompt: asset.userPrompt,
    style: asset.style,
    model: asset.model,
    variants: (asset.variants || []).map((v: any) => ({
      id: v.id,
      variantType: v.variantType,
      mimeType: v.mimeType,
      sizeBytes: v.sizeBytes,
      width: v.width,
      height: v.height,
      url: `/api/media/${asset.id}/file/${variantEnumToSlug(v.variantType)}`,
    })),
    createdAt: asset.createdAt ? new Date(asset.createdAt).toISOString() : new Date().toISOString(),
    updatedAt: asset.updatedAt ? new Date(asset.updatedAt).toISOString() : new Date().toISOString(),
  };

  if (includeAdminDetails) {
    base.grants = (asset.grants || []).map((g: any) => ({
      id: g.id,
      clientId: g.clientId,
      clientSlug: g.client?.slug,
      clientName: g.client?.name,
      permission: g.permission,
      grantedAt: g.grantedAt ? new Date(g.grantedAt).toISOString() : null,
      expiresAt: g.expiresAt ? new Date(g.expiresAt).toISOString() : null,
    }));
    base.jobs = (asset.jobs || []).map((j: any) => ({
      id: j.id,
      jobType: j.jobType,
      status: j.status,
      attempts: j.attempts,
      error: j.error,
      startedAt: j.startedAt ? new Date(j.startedAt).toISOString() : null,
      finishedAt: j.finishedAt ? new Date(j.finishedAt).toISOString() : null,
    }));
  }

  return base;
}
