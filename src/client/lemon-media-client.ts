/**
 * Lemon Media Hub — Standalone Client SDK
 * Lightweight TypeScript client for consuming Lemon Media Hub v2 APIs
 * across lemon-calendarium, lemon-seasons, smart-botanik, and lemon-ai-service.
 */

export type MediaKind = 'IMAGE' | 'VIDEO' | 'AUDIO' | 'DOCUMENT';
export type MediaVisibility = 'PRIVATE' | 'SCOPED' | 'PUBLIC';
export type ProcessingStatus = 'PENDING' | 'PROCESSING' | 'READY' | 'FAILED';

export interface MediaFolder {
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

export interface MediaVariantSummary {
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
  originalFilename: string;
  folderId?: string | null;
  folderPath: string;
  mimeType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  aspectRatio: string;
  durationMs?: number | null;
  codec?: string | null;
  bitrate?: number | null;
  sampleRate?: number | null;
  channels?: number | null;
  waveformPeaks?: number[] | null;
  processingStatus: ProcessingStatus;
  processingError?: string | null;
  processedAt?: string | null;
  visibility: MediaVisibility;
  tags: string[];
  isFavorite: boolean;
  usageCount: number;
  sourceAssetId?: string | null;
  sourceApp: string;
  aiRequestId?: string | null;
  prompt?: string | null;
  userPrompt?: string | null;
  style?: string | null;
  model: string;
  variants?: MediaVariantSummary[];
  createdAt: string;
  updatedAt: string;
}

export interface AssetLineage {
  asset: MediaAsset;
  rootAsset: MediaAsset | null;
  parent: MediaAsset | null;
  ancestors: MediaAsset[];
  children: MediaAsset[];
  siblings: MediaAsset[];
}

export interface QueryAssetsOptions {
  kind?: MediaKind;
  visibility?: MediaVisibility;
  processingStatus?: ProcessingStatus;
  folderId?: string;
  folderPath?: string;
  search?: string;
  style?: string;
  tag?: string;
  isFavorite?: boolean;
  limit?: number;
  offset?: number;
}

export interface UploadMediaOptions {
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

export class LemonMediaClient {
  readonly baseUrl: string;
  private readonly apiKey?: string;
  private readonly bearerToken?: string;

  constructor(options?: { baseUrl?: string; apiKey?: string; bearerToken?: string }) {
    this.baseUrl = (options?.baseUrl || 'http://localhost:3005').replace(/\/$/, '');
    this.apiKey = options?.apiKey;
    this.bearerToken = options?.bearerToken;
  }

  private getAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = {};
    if (this.apiKey) headers['X-Media-Api-Key'] = this.apiKey;
    if (this.bearerToken) headers['Authorization'] = `Bearer ${this.bearerToken}`;
    return headers;
  }

  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const url = `${this.baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
    const headers: Record<string, string> = {
      ...this.getAuthHeaders(),
      ...(options?.headers as Record<string, string> | undefined),
    };
    if (!(options?.body instanceof FormData) && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    const res = await fetch(url, {
      ...options,
      headers,
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      throw new Error(`LemonMediaClient error (${res.status} ${res.statusText}): ${errBody}`);
    }

    return res.json();
  }

  readonly folders = {
    list: async (): Promise<MediaFolder[]> => {
      return this.request<MediaFolder[]>('/api/folders');
    },

    create: async (data: {
      name: string;
      path?: string;
      icon?: string;
      color?: string;
      defaultVisibility?: MediaVisibility;
    }): Promise<MediaFolder> => {
      return this.request<MediaFolder>('/api/folders', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    delete: async (id: string): Promise<{ success: boolean }> => {
      return this.request<{ success: boolean }>(`/api/folders/${id}`, {
        method: 'DELETE',
      });
    },
  };

  readonly assets = {
    list: async (query?: QueryAssetsOptions): Promise<{ items: MediaAsset[]; total: number }> => {
      const params = new URLSearchParams();
      if (query?.kind) params.append('kind', query.kind);
      if (query?.visibility) params.append('visibility', query.visibility);
      if (query?.processingStatus) params.append('processingStatus', query.processingStatus);
      if (query?.folderId) params.append('folderId', query.folderId);
      if (query?.folderPath) params.append('folderPath', query.folderPath);
      if (query?.search) params.append('search', query.search);
      if (query?.style) params.append('style', query.style);
      if (query?.tag) params.append('tag', query.tag);
      if (query?.isFavorite !== undefined) params.append('isFavorite', String(query.isFavorite));
      if (query?.limit) params.append('limit', String(query.limit));
      if (query?.offset) params.append('offset', String(query.offset));

      const qs = params.toString();
      return this.request<{ items: MediaAsset[]; total: number }>(`/api/assets${qs ? `?${qs}` : ''}`);
    },

    getById: async (id: string): Promise<MediaAsset> => {
      return this.request<MediaAsset>(`/api/assets/${id}`);
    },

    getLineage: async (id: string): Promise<AssetLineage> => {
      return this.request<AssetLineage>(`/api/assets/${id}/lineage`);
    },

    uploadBuffer: async (
      buffer: Buffer | Uint8Array,
      filename: string,
      mimeType: string,
      opts?: UploadMediaOptions,
    ): Promise<MediaAsset> => {
      const form = new FormData();
      const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
      form.append('file', new Blob([new Uint8Array(bytes)], { type: mimeType }), filename);
      if (opts?.folderPath) form.append('folderPath', opts.folderPath);
      if (opts?.tags?.length) form.append('tags', opts.tags.join(','));
      if (opts?.title) form.append('title', opts.title);
      if (opts?.description) form.append('description', opts.description);
      if (opts?.visibility) form.append('visibility', opts.visibility);
      if (opts?.allowedClients?.length) form.append('allowedClients', opts.allowedClients.join(','));
      if (opts?.aiRequestId) form.append('aiRequestId', opts.aiRequestId);
      if (opts?.sourceAssetId) form.append('sourceAssetId', opts.sourceAssetId);
      if (opts?.prompt) form.append('prompt', opts.prompt);
      if (opts?.userPrompt) form.append('userPrompt', opts.userPrompt);
      if (opts?.style) form.append('style', opts.style);
      if (opts?.aspectRatio) form.append('aspectRatio', opts.aspectRatio);
      if (opts?.model) form.append('model', opts.model);

      return this.request<MediaAsset>('/api/assets/upload', {
        method: 'POST',
        body: form,
      });
    },

    createSignedUrl: async (
      id: string,
      options?: { variant?: string; ttlSeconds?: number },
    ): Promise<{ assetId: string; variant: string; relativeUrl: string; expiresAt: string; url: string }> => {
      const res = await this.request<{
        assetId: string;
        variant: string;
        relativeUrl: string;
        expiresAt: string;
      }>(`/api/assets/${id}/signed-url`, {
        method: 'POST',
        body: JSON.stringify(options || {}),
      });
      return {
        ...res,
        url: this.resolveUrl(res.relativeUrl),
      };
    },

    updateAccess: async (
      id: string,
      visibility: MediaVisibility,
      clients?: Array<{ clientSlug: string; permission?: 'READ' | 'WRITE'; expiresAt?: string | null }>,
    ): Promise<MediaAsset> => {
      return this.request<MediaAsset>(`/api/assets/${id}/access`, {
        method: 'PATCH',
        body: JSON.stringify({ visibility, clients }),
      });
    },

    toggleFavorite: async (id: string): Promise<MediaAsset> => {
      return this.request<MediaAsset>(`/api/assets/${id}/favorite`, {
        method: 'PATCH',
      });
    },

    incrementUsage: async (id: string): Promise<{ success: boolean }> => {
      return this.request<{ success: boolean }>(`/api/assets/${id}/usage`, {
        method: 'POST',
      });
    },

    delete: async (id: string): Promise<{ success: boolean }> => {
      return this.request<{ success: boolean }>(`/api/assets/${id}`, {
        method: 'DELETE',
      });
    },
  };

  resolveUrl(relativeUrl: string): string {
    if (!relativeUrl) return '';
    if (relativeUrl.startsWith('http://') || relativeUrl.startsWith('https://')) return relativeUrl;
    return `${this.baseUrl}${relativeUrl.startsWith('/') ? relativeUrl : `/${relativeUrl}`}`;
  }
}
