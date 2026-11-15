import React from 'react';
import {
  Heart,
  GitBranch,
  Sparkles,
  Folder,
  Calendar,
  Film,
  Music,
  Lock,
  Users,
  Globe,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import { MediaAsset } from '../types';

interface MediaCardProps {
  asset: MediaAsset;
  onSelect: (asset: MediaAsset) => void;
  onToggleFavorite: (e: React.MouseEvent, asset: MediaAsset) => void;
  onRemix: (e: React.MouseEvent, asset: MediaAsset) => void;
  onViewLineage: (e: React.MouseEvent, asset: MediaAsset) => void;
  canAiRemix?: boolean;
}

function formatDuration(ms?: number | null): string {
  if (!ms || ms <= 0) return '';
  const totalSec = Math.round(ms / 1000);
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

export const MediaCard: React.FC<MediaCardProps> = ({
  asset,
  onSelect,
  onToggleFavorite,
  onRemix,
  onViewLineage,
  canAiRemix,
}) => {
  const isRemix = Boolean(asset.sourceAssetId);

  const getAspectRatioClass = (ratio: string) => {
    switch (ratio) {
      case '1:1':
        return 'aspect-square';
      case '9:16':
        return 'aspect-[9/16]';
      case '4:3':
        return 'aspect-[4/3]';
      case '3:4':
        return 'aspect-[3/4]';
      case '16:9':
      default:
        return 'aspect-[16/9]';
    }
  };

  const formattedDate = new Date(asset.createdAt).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

  const VisibilityIcon =
    asset.visibility === 'PUBLIC'
      ? Globe
      : asset.visibility === 'SCOPED'
        ? Users
        : Lock;

  const visibilityStyle =
    asset.visibility === 'PUBLIC'
      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
      : asset.visibility === 'SCOPED'
        ? 'bg-sky-500/20 text-sky-300 border-sky-500/40'
        : 'bg-slate-900/80 text-slate-300 border-slate-700/60';

  const hasThumbImage =
    asset.kind === 'IMAGE' ||
    (asset.kind === 'VIDEO' && Boolean(asset.variants?.some((v) => v.variantType === 'THUMB_360' || v.variantType === 'POSTER_JPG')));

  return (
    <div
      onClick={() => onSelect(asset)}
      className="group relative bg-slate-900/90 rounded-2xl border border-slate-800/80 overflow-hidden hover:border-amber-500/50 hover:shadow-xl hover:shadow-amber-500/5 transition-all duration-300 flex flex-col cursor-pointer"
    >
      {/* Thumbnail Container */}
      <div className={`w-full overflow-hidden relative bg-slate-950 ${getAspectRatioClass(asset.aspectRatio)}`}>
        {hasThumbImage ? (
          <img
            src={asset.thumbnailUrl || asset.url}
            alt={asset.title || asset.prompt || asset.filename}
            loading="lazy"
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : asset.kind === 'AUDIO' ? (
          <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-cyan-950/30 to-slate-950 p-4">
            <Music className="w-8 h-8 text-cyan-400 mb-2" />
            {Array.isArray(asset.waveformPeaks) && asset.waveformPeaks.length > 0 && (
              <div className="flex items-end gap-0.5 h-8 w-full max-w-[160px] justify-center">
                {asset.waveformPeaks.slice(0, 32).map((p, idx) => (
                  <span
                    key={idx}
                    className="w-1 bg-cyan-400/70 rounded-full"
                    style={{ height: `${Math.max(12, p)}%` }}
                  />
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900 text-slate-400">
            <Film className="w-8 h-8 text-rose-400 mb-1" />
            <span className="text-[10px] font-mono uppercase">{asset.kind}</span>
          </div>
        )}

        {/* Always-visible top-left Visibility + Kind/Duration Badges */}
        <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 flex-wrap">
          <span
            className={`px-2 py-0.5 rounded-full backdrop-blur-md text-[10px] font-medium border flex items-center gap-1 ${visibilityStyle}`}
          >
            <VisibilityIcon className="w-2.5 h-2.5" />
            {asset.visibility}
          </span>
          {asset.kind !== 'IMAGE' && (
            <span className="px-2 py-0.5 rounded-full bg-slate-900/85 backdrop-blur-md text-[10px] font-mono text-slate-200 border border-slate-700/60 flex items-center gap-1">
              {asset.kind === 'VIDEO' ? <Film className="w-2.5 h-2.5 text-rose-400" /> : <Music className="w-2.5 h-2.5 text-cyan-400" />}
              {asset.durationMs ? formatDuration(asset.durationMs) : asset.kind}
            </span>
          )}
        </div>

        {/* Processing Status Overlay */}
        {(asset.processingStatus === 'PENDING' || asset.processingStatus === 'PROCESSING') && (
          <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-[2px] flex flex-col items-center justify-center text-amber-300 text-xs font-medium gap-1.5">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Обработка...</span>
          </div>
        )}
        {asset.processingStatus === 'FAILED' && (
          <div className="absolute bottom-2 left-2 px-2 py-1 rounded-lg bg-rose-500/20 border border-rose-500/40 text-rose-300 text-[10px] flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            <span>Ошибка обработки</span>
          </div>
        )}

        {/* Hover Controls */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-3">
          <div className="flex items-center justify-end gap-1.5">
            {isRemix && (
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 backdrop-blur-md text-[10px] font-medium text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                <GitBranch className="w-2.5 h-2.5" />
                Потомок
              </span>
            )}
            <button
              onClick={(e) => onToggleFavorite(e, asset)}
              className="p-2 rounded-full bg-slate-900/80 backdrop-blur-md text-slate-300 hover:text-rose-400 border border-slate-700/60 transition-colors shadow-sm"
              title="Избранное"
            >
              <Heart className={`w-4 h-4 ${asset.isFavorite ? 'text-rose-500 fill-rose-500' : ''}`} />
            </button>
          </div>

          <div className="flex items-center justify-end gap-2">
            <button
              onClick={(e) => onViewLineage(e, asset)}
              className="px-2.5 py-1.5 rounded-lg bg-slate-900/90 backdrop-blur-md text-slate-200 hover:text-amber-300 hover:bg-slate-800 text-xs font-medium border border-slate-700/60 transition-colors flex items-center gap-1.5"
            >
              <GitBranch className="w-3.5 h-3.5 text-amber-400" />
              <span>Детали</span>
            </button>
            {canAiRemix && asset.kind === 'IMAGE' && (
              <button
                onClick={(e) => onRemix(e, asset)}
                className="px-2.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-semibold shadow-md transition-all flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5 fill-slate-950/20" />
                <span>Ремикс</span>
              </button>
            )}
          </div>
        </div>

        {asset.isFavorite && (
          <div className="absolute top-2.5 right-2.5 p-1 rounded-full bg-rose-500/20 backdrop-blur-md border border-rose-500/30 group-hover:hidden">
            <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" />
          </div>
        )}
      </div>

      {/* Card Info */}
      <div className="p-3.5 flex-1 flex flex-col justify-between">
        <div>
          <p className="text-xs text-slate-200 font-medium line-clamp-2 leading-relaxed">
            {asset.title || asset.userPrompt || asset.prompt || asset.filename}
          </p>

          <div className="mt-2 flex items-center gap-1.5 flex-wrap">
            {asset.style && (
              <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-800 text-slate-400 font-mono">
                #{asset.style}
              </span>
            )}
            <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-800 text-slate-400 font-mono flex items-center gap-1">
              <Folder className="w-2.5 h-2.5" />
              {asset.folderPath}
            </span>
          </div>
        </div>

        <div className="mt-3 pt-2.5 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-500">
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3 text-slate-500" />
            {formattedDate}
          </span>
          <span className="font-mono text-[10px] text-slate-400">
            {asset.width && asset.height
              ? `${asset.width}×${asset.height}`
              : `${(asset.sizeBytes / 1024).toFixed(0)} KB`}
          </span>
        </div>
      </div>
    </div>
  );
};
