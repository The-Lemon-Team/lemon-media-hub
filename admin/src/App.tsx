import React, { useState, useEffect, useCallback } from 'react';
import { Sidebar } from './components/Sidebar';
import { MediaGallery } from './components/MediaGallery';
import { GenerateModal } from './components/GenerateModal';
import { RemixModal } from './components/RemixModal';
import { AssetDetailModal } from './components/AssetDetailModal';
import { CreateFolderModal } from './components/CreateFolderModal';
import { LoginScreen } from './components/LoginScreen';
import { UploadModal } from './components/UploadModal';
import { ClientsModal } from './components/ClientsModal';
import {
  HubHealthStatus,
  MediaAsset,
  MediaFolder,
  MediaKind,
  MediaVisibility,
  ServiceClient,
} from './types';
import {
  checkAuth,
  logoutAdmin,
  fetchHealth,
  fetchFolders,
  fetchAssets,
  fetchClients,
  toggleFavorite,
  checkAiStatus,
} from './api';

export const App: React.FC = () => {
  const [authChecked, setAuthChecked] = useState(false);
  const [adminUser, setAdminUser] = useState<{ username: string; role: string } | null>(null);

  const [folders, setFolders] = useState<MediaFolder[]>([]);
  const [clients, setClients] = useState<ServiceClient[]>([]);
  const [activeFolder, setActiveFolder] = useState<string>('all');
  const [selectedKind, setSelectedKind] = useState<MediaKind | 'ALL'>('ALL');
  const [selectedVisibility, setSelectedVisibility] = useState<MediaVisibility | 'ALL'>('ALL');
  const [showOnlyFavorites, setShowOnlyFavorites] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedStyle, setSelectedStyle] = useState<string>('all');

  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);

  const [isUploadOpen, setIsUploadOpen] = useState<boolean>(false);
  const [isGenerateOpen, setIsGenerateOpen] = useState<boolean>(false);
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState<boolean>(false);
  const [isClientsOpen, setIsClientsOpen] = useState<boolean>(false);
  const [selectedAsset, setSelectedAsset] = useState<MediaAsset | null>(null);
  const [remixSourceAsset, setRemixSourceAsset] = useState<MediaAsset | null>(null);

  const [health, setHealth] = useState<HubHealthStatus | null>(null);
  const [aiStatus, setAiStatus] = useState<{
    configured: boolean;
    textModels: string[];
    imageModels: string[];
  } | null>(null);

  useEffect(() => {
    checkAuth()
      .then((user) => setAdminUser(user))
      .finally(() => setAuthChecked(true));

    const handleUnauth = () => setAdminUser(null);
    window.addEventListener('lmh:unauthorized', handleUnauth);
    return () => window.removeEventListener('lmh:unauthorized', handleUnauth);
  }, []);

  const loadMetadata = useCallback(async () => {
    if (!adminUser) return;
    fetchHealth().then(setHealth).catch(() => {});
    fetchFolders().then(setFolders).catch((err) => console.error('Failed to load folders', err));
    fetchClients().then(setClients).catch((err) => console.error('Failed to load clients', err));
    checkAiStatus().then(setAiStatus).catch(() => {});
  }, [adminUser]);

  useEffect(() => {
    loadMetadata();
  }, [loadMetadata]);

  const loadAssets = useCallback(async () => {
    if (!adminUser) return;
    setLoading(true);
    try {
      const res = await fetchAssets({
        kind: selectedKind,
        visibility: selectedVisibility,
        folderPath: activeFolder,
        search: searchQuery,
        style: selectedStyle,
        isFavorite: showOnlyFavorites,
        limit: 100,
      });
      setAssets(res.items);
      setTotalCount(res.total);
    } catch (err) {
      console.error('Failed to load assets', err);
    } finally {
      setLoading(false);
    }
  }, [
    adminUser,
    selectedKind,
    selectedVisibility,
    activeFolder,
    searchQuery,
    selectedStyle,
    showOnlyFavorites,
  ]);

  useEffect(() => {
    loadAssets();
  }, [loadAssets]);

  // Auto-poll while any visible asset is PENDING or PROCESSING
  useEffect(() => {
    const hasPending = assets.some(
      (a) => a.processingStatus === 'PENDING' || a.processingStatus === 'PROCESSING',
    );
    if (!hasPending || !adminUser) return;
    const timer = setInterval(() => {
      void loadAssets();
    }, 3000);
    return () => clearInterval(timer);
  }, [assets, adminUser, loadAssets]);

  const handleToggleFavorite = async (e: React.MouseEvent, asset: MediaAsset) => {
    e.stopPropagation();
    try {
      const updated = await toggleFavorite(asset.id);
      setAssets((prev) => prev.map((item) => (item.id === asset.id ? updated : item)));
      if (selectedAsset?.id === asset.id) setSelectedAsset(updated);
    } catch (err) {
      console.error(err);
    }
  };

  const handleRemixClick = (e: React.MouseEvent, asset: MediaAsset) => {
    e.stopPropagation();
    setRemixSourceAsset(asset);
  };

  const handleViewLineage = (e: React.MouseEvent, asset: MediaAsset) => {
    e.stopPropagation();
    setSelectedAsset(asset);
  };

  const handleAssetsAdded = (newAssets: MediaAsset[]) => {
    loadAssets();
    loadMetadata();
    if (newAssets.length > 0) setSelectedAsset(newAssets[0]);
  };

  const handleFolderCreated = (newFolder: MediaFolder) => {
    setFolders((prev) => [...prev, newFolder]);
    setActiveFolder(newFolder.path);
    setShowOnlyFavorites(false);
  };

  const handleAssetUpdated = (updated: MediaAsset) => {
    setAssets((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
    setSelectedAsset(updated);
  };

  const handleAssetDeleted = (deletedId: string) => {
    setAssets((prev) => prev.filter((item) => item.id !== deletedId));
    setTotalCount((c) => Math.max(0, c - 1));
    if (selectedAsset?.id === deletedId) setSelectedAsset(null);
  };

  const handleLogout = async () => {
    await logoutAdmin();
    setAdminUser(null);
  };

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400 text-sm">
        Загрузка...
      </div>
    );
  }

  if (!adminUser) {
    return <LoginScreen onSuccess={(admin) => setAdminUser(admin)} />;
  }

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 overflow-hidden font-sans">
      <Sidebar
        folders={folders}
        activeFolder={activeFolder}
        onSelectFolder={(path) => {
          setActiveFolder(path);
          setShowOnlyFavorites(false);
        }}
        showOnlyFavorites={showOnlyFavorites}
        onToggleFavorites={(val) => setShowOnlyFavorites(val)}
        onOpenUploadModal={() => setIsUploadOpen(true)}
        onOpenGenerateModal={() => setIsGenerateOpen(true)}
        onOpenCreateFolderModal={() => setIsCreateFolderOpen(true)}
        onOpenClientsModal={() => setIsClientsOpen(true)}
        onLogout={handleLogout}
        totalAssetsCount={totalCount}
        aiStatus={aiStatus}
        health={health}
      />

      <MediaGallery
        assets={assets}
        folders={folders}
        activeFolder={activeFolder}
        showOnlyFavorites={showOnlyFavorites}
        selectedKind={selectedKind}
        onKindChange={setSelectedKind}
        selectedVisibility={selectedVisibility}
        onVisibilityChange={setSelectedVisibility}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        selectedStyle={selectedStyle}
        onStyleChange={setSelectedStyle}
        onSelectAsset={(asset) => setSelectedAsset(asset)}
        onToggleFavorite={handleToggleFavorite}
        onRemix={handleRemixClick}
        onViewLineage={handleViewLineage}
        onOpenUploadModal={() => setIsUploadOpen(true)}
        canAiRemix={Boolean(aiStatus?.configured)}
        loading={loading}
      />

      {isUploadOpen && (
        <UploadModal
          folders={folders}
          clients={clients}
          defaultFolder={activeFolder !== 'all' ? activeFolder : 'covers'}
          onClose={() => setIsUploadOpen(false)}
          onSuccess={handleAssetsAdded}
        />
      )}

      {isGenerateOpen && (
        <GenerateModal
          folders={folders}
          defaultFolder={activeFolder !== 'all' ? activeFolder : 'covers'}
          onClose={() => setIsGenerateOpen(false)}
          onSuccess={handleAssetsAdded}
        />
      )}

      {remixSourceAsset && (
        <RemixModal
          sourceAsset={remixSourceAsset}
          folders={folders}
          onClose={() => setRemixSourceAsset(null)}
          onSuccess={handleAssetsAdded}
        />
      )}

      {selectedAsset && (
        <AssetDetailModal
          asset={selectedAsset}
          clients={clients}
          canAiRemix={Boolean(aiStatus?.configured)}
          onClose={() => setSelectedAsset(null)}
          onAssetUpdated={handleAssetUpdated}
          onAssetDeleted={handleAssetDeleted}
          onRemix={(asset) => setRemixSourceAsset(asset)}
          onSelectAnotherAsset={(asset) => setSelectedAsset(asset)}
        />
      )}

      {isCreateFolderOpen && (
        <CreateFolderModal
          onClose={() => setIsCreateFolderOpen(false)}
          onSuccess={handleFolderCreated}
        />
      )}

      {isClientsOpen && (
        <ClientsModal
          clients={clients}
          onClientsChanged={loadMetadata}
          onClose={() => setIsClientsOpen(false)}
        />
      )}
    </div>
  );
};

export default App;
