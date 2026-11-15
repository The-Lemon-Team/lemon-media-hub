import {
  AssetLineage,
  CreateFolderDto,
  GenerateImageBatchDto,
  HubHealthStatus,
  MediaAsset,
  MediaFolder,
  MediaKind,
  MediaVisibility,
  RemixImageDto,
  ServiceClient,
} from './types';

const API_BASE = '/api';

async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    credentials: 'include',
    ...init,
  });
  if (res.status === 401) {
    window.dispatchEvent(new CustomEvent('lmh:unauthorized'));
    throw new Error('Unauthorized');
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function checkAuth(): Promise<{ username: string; role: string } | null> {
  const res = await fetch(`${API_BASE}/auth/me`, { credentials: 'include' });
  if (!res.ok) return null;
  return res.json();
}

export async function loginAdmin(
  username: string,
  password: string,
): Promise<{ accessToken: string; admin: { username: string; role: string } }> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Неверный логин или пароль' }));
    throw new Error(err.message || 'Ошибка входа');
  }
  return res.json();
}

export async function logoutAdmin(): Promise<void> {
  await fetch(`${API_BASE}/auth/logout`, {
    method: 'POST',
    credentials: 'include',
  });
}

export async function fetchHealth(): Promise<HubHealthStatus | null> {
  const res = await fetch(`${API_BASE}/health`, { credentials: 'include' });
  if (!res.ok) return null;
  return res.json();
}

export async function fetchFolders(): Promise<MediaFolder[]> {
  return apiFetch<MediaFolder[]>(`${API_BASE}/folders`);
}

export async function createFolder(dto: CreateFolderDto): Promise<MediaFolder> {
  return apiFetch<MediaFolder>(`${API_BASE}/folders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dto),
  });
}

export async function deleteFolder(id: string): Promise<boolean> {
  const data = await apiFetch<{ success: boolean }>(`${API_BASE}/folders/${id}`, {
    method: 'DELETE',
  });
  return data.success;
}

export async function fetchAssets(params: {
  kind?: MediaKind | 'ALL';
  visibility?: MediaVisibility | 'ALL';
  folderPath?: string;
  search?: string;
  style?: string;
  isFavorite?: boolean;
  limit?: number;
  offset?: number;
}): Promise<{ items: MediaAsset[]; total: number }> {
  const query = new URLSearchParams();
  if (params.kind && params.kind !== 'ALL') query.set('kind', params.kind);
  if (params.visibility && params.visibility !== 'ALL') query.set('visibility', params.visibility);
  if (params.folderPath && params.folderPath !== 'all') query.set('folderPath', params.folderPath);
  if (params.search) query.set('search', params.search);
  if (params.style && params.style !== 'all') query.set('style', params.style);
  if (params.isFavorite) query.set('isFavorite', 'true');
  if (params.limit) query.set('limit', String(params.limit));
  if (params.offset) query.set('offset', String(params.offset));

  return apiFetch<{ items: MediaAsset[]; total: number }>(`${API_BASE}/assets?${query.toString()}`);
}

export async function fetchAssetById(id: string): Promise<MediaAsset> {
  return apiFetch<MediaAsset>(`${API_BASE}/assets/${id}`);
}

export async function fetchAssetLineage(id: string): Promise<AssetLineage> {
  return apiFetch<AssetLineage>(`${API_BASE}/assets/${id}/lineage`);
}

export async function uploadMediaFile(
  file: File,
  opts: {
    folderPath?: string;
    tags?: string[];
    title?: string;
    visibility?: MediaVisibility;
    allowedClients?: string[];
  },
): Promise<MediaAsset> {
  const form = new FormData();
  form.append('file', file);
  if (opts.folderPath) form.append('folderPath', opts.folderPath);
  if (opts.tags?.length) form.append('tags', opts.tags.join(','));
  if (opts.title) form.append('title', opts.title);
  if (opts.visibility) form.append('visibility', opts.visibility);
  if (opts.allowedClients?.length) form.append('allowedClients', opts.allowedClients.join(','));

  return apiFetch<MediaAsset>(`${API_BASE}/assets/upload`, {
    method: 'POST',
    body: form,
  });
}

export async function updateAssetAccess(
  id: string,
  visibility: MediaVisibility,
  clients: Array<{ clientSlug: string; permission?: 'READ' | 'WRITE' }>,
): Promise<MediaAsset> {
  return apiFetch<MediaAsset>(`${API_BASE}/assets/${id}/access`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ visibility, clients }),
  });
}

export async function createSignedUrl(
  id: string,
  variant = 'full',
  ttlSeconds = 3600,
): Promise<{ relativeUrl: string; expiresAt: string }> {
  return apiFetch<{ relativeUrl: string; expiresAt: string }>(
    `${API_BASE}/assets/${id}/signed-url`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ variant, ttlSeconds }),
    },
  );
}

export async function reprocessAsset(id: string): Promise<MediaAsset> {
  return apiFetch<MediaAsset>(`${API_BASE}/assets/${id}/reprocess`, {
    method: 'POST',
  });
}

export async function toggleFavorite(id: string): Promise<MediaAsset> {
  return apiFetch<MediaAsset>(`${API_BASE}/assets/${id}/favorite`, { method: 'PATCH' });
}

export async function deleteAsset(id: string): Promise<boolean> {
  await apiFetch(`${API_BASE}/assets/${id}`, { method: 'DELETE' });
  return true;
}

export async function fetchClients(): Promise<ServiceClient[]> {
  return apiFetch<ServiceClient[]>(`${API_BASE}/clients`);
}

export async function createClient(dto: {
  slug: string;
  name: string;
  scopes: string[];
}): Promise<ServiceClient> {
  return apiFetch<ServiceClient>(`${API_BASE}/clients`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dto),
  });
}

export async function rotateClientKey(id: string): Promise<{ apiKey: string; apiKeyPrefix: string }> {
  return apiFetch<{ apiKey: string; apiKeyPrefix: string }>(
    `${API_BASE}/clients/${id}/rotate-key`,
    { method: 'POST' },
  );
}

export async function toggleClientActive(id: string, isActive: boolean): Promise<ServiceClient> {
  return apiFetch<ServiceClient>(`${API_BASE}/clients/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ isActive }),
  });
}

export async function generateImages(
  dto: GenerateImageBatchDto,
): Promise<{ items: MediaAsset[]; [key: string]: any }> {
  return apiFetch(`${API_BASE}/ai-studio/generate-images`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dto),
  });
}

export async function remixImage(
  dto: RemixImageDto,
): Promise<{ items: MediaAsset[]; [key: string]: any }> {
  return apiFetch(`${API_BASE}/ai-studio/remix-image`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dto),
  });
}

export async function checkAiStatus(): Promise<{
  configured: boolean;
  textModels: string[];
  imageModels: string[];
}> {
  try {
    return await apiFetch(`${API_BASE}/ai-studio/status`);
  } catch {
    return { configured: false, textModels: [], imageModels: [] };
  }
}
