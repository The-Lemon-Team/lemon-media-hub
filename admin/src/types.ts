export type MediaKind = 'IMAGE' | 'VIDEO' | 'AUDIO' | 'DOCUMENT';
export type MediaVisibility = 'PRIVATE' | 'SCOPED' | 'PUBLIC';
export type ProcessingStatus = 'PENDING' | 'PROCESSING' | 'READY' | 'FAILED';

export interface MediaFolder {
  id: string;
  name: string;
  path: string;
  icon?: string | null;
  color?: string | null;
  defaultVisibility: MediaVisibility;
  assetsCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface AssetAccessGrant {
  id: string;
  clientId: string;
  clientSlug: string;
  clientName: string;
  permission: 'READ' | 'WRITE';
  grantedAt: string;
  expiresAt?: string | null;
}

export interface MediaVariant {
  id: string;
  variantType: string;
  mimeType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  url: string;
}

export interface MediaAsset {
  id: string;
  kind: MediaKind;
  title?: string | null;
  description?: string | null;
  url: string;
  thumbnailUrl: string;
  filename: string;
  originalFilename?: string;
  folderId?: string | null;
  folderPath: string;
  prompt?: string | null;
  userPrompt?: string | null;
  style?: string | null;
  aspectRatio: string;
  model: string;
  sourceAssetId?: string | null;
  sourceApp?: string;
  width: number | null;
  height: number | null;
  sizeBytes: number;
  mimeType: string;
  durationMs?: number | null;
  codec?: string | null;
  bitrate?: number | null;
  sampleRate?: number | null;
  channels?: number | null;
  waveformPeaks?: number[] | null;
  processingStatus: ProcessingStatus;
  processingError?: string | null;
  visibility: MediaVisibility;
  grants?: AssetAccessGrant[];
  variants?: MediaVariant[];
  tags: string[];
  isFavorite: boolean;
  usageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ServiceClient {
  id: string;
  slug: string;
  name: string;
  apiKeyPrefix: string;
  apiKey?: string;
  scopes: string[];
  isActive: boolean;
  grantsCount?: number;
  createdAt: string;
}

export interface AssetLineage {
  asset: MediaAsset;
  rootAsset: MediaAsset | null;
  parent: MediaAsset | null;
  ancestors: MediaAsset[];
  children: MediaAsset[];
  siblings: MediaAsset[];
}

export interface GenerateImageBatchDto {
  prompt: string;
  style?: string;
  aspectRatio?: string;
  folderPath?: string;
  count?: number;
}

export interface RemixImageDto {
  sourceAssetId: string;
  instruction: string;
  style?: string;
  aspectRatio?: string;
  count?: number;
  folderPath?: string;
}

export interface CreateFolderDto {
  name: string;
  path: string;
  icon?: string;
  color?: string;
}

export interface HubHealthStatus {
  status: string;
  database: string;
  queueReady: boolean;
  ffmpegAvailable: boolean;
}
