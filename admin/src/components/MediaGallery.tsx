import React from 'react';
import { Search, Upload, Filter, X } from 'lucide-react';
import { MediaAsset, MediaFolder, MediaKind, MediaVisibility } from '../types';
import { MediaCard } from './MediaCard';

interface MediaGalleryProps {
  assets: MediaAsset[];
  folders: MediaFolder[];
  activeFolder: string;
  showOnlyFavorites: boolean;
  selectedKind: MediaKind | 'ALL';
  onKindChange: (k: MediaKind | 'ALL') => void;
  selectedVisibility: MediaVisibility | 'ALL';
  onVisibilityChange: (v: MediaVisibility | 'ALL') => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  selectedStyle: string;
  onStyleChange: (s: string) => void;
  onSelectAsset: (asset: MediaAsset) => void;
  onToggleFavorite: (e: React.MouseEvent, asset: MediaAsset) => void;
  onRemix: (e: React.MouseEvent, asset: MediaAsset) => void;
  onViewLineage: (e: React.MouseEvent, asset: MediaAsset) => void;
  onOpenUploadModal: () => void;
  canAiRemix?: boolean;
  loading: boolean;
}

const KIND_TABS: Array<{ id: MediaKind | 'ALL'; label: string }> = [
  { id: 'ALL', label: 'Все' },
  { id: 'IMAGE', label: 'Фото' },
  { id: 'VIDEO', label: 'Видео' },
  { id: 'AUDIO', label: 'Аудио' },
];

export const MediaGallery: React.FC<MediaGalleryProps> = ({
  assets,
  folders,
  activeFolder,
  showOnlyFavorites,
  selectedKind,
  onKindChange,
  selectedVisibility,
  onVisibilityChange,
  searchQuery,
  onSearchChange,
  onSelectAsset,
  onToggleFavorite,
  onRemix,
  onViewLineage,
  onOpenUploadModal,
  canAiRemix,
  loading,
}) => {
  const currentFolder = folders.find((f) => f.path === activeFolder);

  const getTitle = () => {
    if (showOnlyFavorites) return 'Избранное';
    if (activeFolder === 'all') return 'Все медиа-ресурсы';
    if (activeFolder === 'remixes') return 'Ремиксы и вариации';
    return currentFolder ? currentFolder.name : `Папка /${activeFolder}`;
  };

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-slate-950">
      {/* Top Bar */}
      <div className="p-4 border-b border-slate-800/80 bg-slate-900/50 backdrop-blur-md flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            {currentFolder && (
              <span
                className="w-3 h-3 rounded-full inline-block"
                style={{ backgroundColor: currentFolder.color || '#f59e0b' }}
              />
            )}
            {getTitle()}
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-mono font-normal">
              {assets.length}
            </span>
          </h2>

          {/* Media Kind Switcher */}
          <div className="flex items-center bg-slate-900 rounded-xl p-1 border border-slate-800">
            {KIND_TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => onKindChange(tab.id)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                  selectedKind === tab.id
                    ? 'bg-amber-500 text-slate-950 font-semibold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Filters and Search */}
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <select
              value={selectedVisibility}
              onChange={(e) => onVisibilityChange(e.target.value as MediaVisibility | 'ALL')}
              className="appearance-none bg-slate-800/80 hover:bg-slate-800 text-slate-200 text-xs rounded-xl px-3 py-2 pr-8 border border-slate-700/60 focus:outline-none focus:border-amber-500 cursor-pointer"
            >
              <option value="ALL">Все уровни доступа</option>
              <option value="PRIVATE">🔒 Private (Админ)</option>
              <option value="SCOPED">👥 Scoped (По проектам)</option>
              <option value="PUBLIC">🌐 Public (Открытые)</option>
            </select>
            <Filter className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          <div className="relative w-60">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Поиск по названию, тегам..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full pl-9 pr-8 py-2 bg-slate-800/80 text-xs rounded-xl text-slate-200 placeholder-slate-500 border border-slate-700/60 focus:outline-none focus:border-amber-500"
            />
            {searchQuery && (
              <button
                onClick={() => onSearchChange('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-400">
            <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-sm">Загрузка медиа...</p>
          </div>
        ) : assets.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-80 text-center border-2 border-dashed border-slate-800/80 rounded-2xl p-8 max-w-lg mx-auto my-12">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-400 mb-4 text-2xl">
              🍋
            </div>
            <h3 className="text-base font-semibold text-slate-200 mb-1">
              В этой выборке нет медиа
            </h3>
            <p className="text-xs text-slate-400 mb-6 max-w-xs">
              Загрузите изображение, видео или аудиофайл с диска либо измените фильтры.
            </p>
            <button
              onClick={onOpenUploadModal}
              className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold rounded-xl text-xs shadow-md transition-all cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              <span>Загрузить файл</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5">
            {assets.map((asset) => (
              <MediaCard
                key={asset.id}
                asset={asset}
                onSelect={onSelectAsset}
                onToggleFavorite={onToggleFavorite}
                onRemix={onRemix}
                onViewLineage={onViewLineage}
                canAiRemix={canAiRemix}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
