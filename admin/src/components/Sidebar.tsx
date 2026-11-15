import React from 'react';
import {
  Folder,
  Sparkles,
  Heart,
  Layers,
  Plus,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  Upload,
  KeyRound,
  LogOut,
} from 'lucide-react';
import { HubHealthStatus, MediaFolder } from '../types';

interface SidebarProps {
  folders: MediaFolder[];
  activeFolder: string;
  onSelectFolder: (path: string) => void;
  showOnlyFavorites: boolean;
  onToggleFavorites: (val: boolean) => void;
  onOpenUploadModal: () => void;
  onOpenGenerateModal: () => void;
  onOpenCreateFolderModal: () => void;
  onOpenClientsModal: () => void;
  onLogout: () => void;
  totalAssetsCount: number;
  aiStatus: { configured: boolean; textModels: string[]; imageModels: string[] } | null;
  health: HubHealthStatus | null;
}

export const Sidebar: React.FC<SidebarProps> = ({
  folders,
  activeFolder,
  onSelectFolder,
  showOnlyFavorites,
  onToggleFavorites,
  onOpenUploadModal,
  onOpenGenerateModal,
  onOpenCreateFolderModal,
  onOpenClientsModal,
  onLogout,
  totalAssetsCount,
  aiStatus,
  health,
}) => {
  return (
    <aside className="w-64 bg-slate-900/80 border-r border-slate-800/80 flex flex-col h-screen shrink-0 select-none backdrop-blur-md">
      {/* Brand Header */}
      <div className="p-4 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 to-yellow-300 flex items-center justify-center text-xl shadow-lg shadow-amber-500/20">
            🍋
          </div>
          <div>
            <h1 className="font-bold text-sm tracking-tight text-white leading-tight">
              Lemon Media
            </h1>
            <span className="text-[11px] font-medium text-amber-400/90 flex items-center gap-1">
              Media & Access Hub
            </span>
          </div>
        </div>
        <button
          onClick={onLogout}
          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
          title="Выйти"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>

      {/* Primary Action Buttons */}
      <div className="p-4 space-y-2">
        <button
          onClick={onOpenUploadModal}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-amber-500 hover:from-amber-400 to-yellow-500 hover:to-yellow-400 text-slate-950 font-semibold rounded-xl text-sm shadow-md shadow-amber-500/20 transition-all cursor-pointer"
        >
          <Upload className="w-4 h-4" />
          <span>Загрузить медиа</span>
        </button>

        {aiStatus?.configured && (
          <button
            onClick={onOpenGenerateModal}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-slate-800/90 hover:bg-slate-800 text-amber-300 font-medium rounded-xl text-xs border border-slate-700/80 transition-all cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI Генерация</span>
          </button>
        )}
      </div>

      {/* Main Navigation */}
      <div className="px-3 space-y-1">
        <button
          onClick={() => {
            onToggleFavorites(false);
            onSelectFolder('all');
          }}
          className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeFolder === 'all' && !showOnlyFavorites
              ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
              : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <ImageIcon className="w-4 h-4 text-amber-400" />
            <span>Все медиа</span>
          </div>
          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-mono">
            {totalAssetsCount}
          </span>
        </button>

        <button
          onClick={() => onToggleFavorites(true)}
          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
            showOnlyFavorites
              ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
              : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
          }`}
        >
          <Heart className={`w-4 h-4 ${showOnlyFavorites ? 'text-rose-400 fill-rose-400' : 'text-slate-400'}`} />
          <span>Избранное</span>
        </button>

        <button
          onClick={() => {
            onToggleFavorites(false);
            onSelectFolder('remixes');
          }}
          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeFolder === 'remixes' && !showOnlyFavorites
              ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
              : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
          }`}
        >
          <Layers className="w-4 h-4 text-emerald-400" />
          <span>Ремиксы и вариации</span>
        </button>

        <button
          onClick={onOpenClientsModal}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-slate-300 hover:bg-slate-800/60 hover:text-white transition-colors"
        >
          <KeyRound className="w-4 h-4 text-sky-400" />
          <span>Приложения и ключи</span>
        </button>
      </div>

      {/* Folders Section */}
      <div className="mt-5 flex-1 overflow-y-auto px-3">
        <div className="flex items-center justify-between px-2 py-1 mb-1">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Папки DAM
          </span>
          <button
            onClick={onOpenCreateFolderModal}
            className="p-1 rounded-md text-slate-400 hover:text-amber-400 hover:bg-slate-800 transition-colors"
            title="Создать папку"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="space-y-1">
          {folders.map((folder) => {
            const isActive = activeFolder === folder.path && !showOnlyFavorites;
            return (
              <button
                key={folder.id}
                onClick={() => {
                  onToggleFavorites(false);
                  onSelectFolder(folder.path);
                }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors text-left ${
                  isActive
                    ? 'bg-slate-800 text-amber-300 font-medium'
                    : 'text-slate-300 hover:bg-slate-800/50 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2.5 truncate">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: folder.color || '#f59e0b' }}
                  />
                  <Folder className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="truncate">{folder.name}</span>
                </div>
                <span className="text-[11px] text-slate-500 font-mono">
                  {folder.assetsCount ?? `/${folder.path}`}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* System Status Footer */}
      <div className="p-3 border-t border-slate-800/80 bg-slate-950/40 text-[11px] space-y-1">
        <div className="flex items-center justify-between text-slate-400">
          <span className="flex items-center gap-1.5">
            {health?.database === 'connected' ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
            )}
            Postgres + Queue
          </span>
          <span className="font-mono text-[10px]">
            {health?.ffmpegAvailable ? 'FFmpeg OK' : 'No FFmpeg'}
          </span>
        </div>
        <div className="flex items-center justify-between text-slate-400">
          <span className="flex items-center gap-1.5">
            {aiStatus?.configured ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <AlertCircle className="w-3.5 h-3.5 text-slate-500" />
            )}
            Lemon AI Service
          </span>
          <span className="text-[10px] font-mono">
            {aiStatus?.configured ? 'Connected' : 'Standalone'}
          </span>
        </div>
      </div>
    </aside>
  );
};
