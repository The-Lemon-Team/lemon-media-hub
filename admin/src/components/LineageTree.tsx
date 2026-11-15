import React from 'react';
import { GitBranch, ArrowRight, CornerDownRight, Sparkles, Folder } from 'lucide-react';
import { AssetLineage, MediaAsset } from '../types';

interface LineageTreeProps {
  lineage: AssetLineage;
  onSelectAsset: (asset: MediaAsset) => void;
  onRemixAsset: (asset: MediaAsset) => void;
}

export const LineageTree: React.FC<LineageTreeProps> = ({
  lineage,
  onSelectAsset,
  onRemixAsset,
}) => {
  const { asset, rootAsset, parent, ancestors, children, siblings } = lineage;

  const isRoot = !asset.sourceAssetId;

  return (
    <div className="space-y-6">
      {/* Overview Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <GitBranch className="w-5 h-5 text-amber-400" />
          <h3 className="font-semibold text-sm text-slate-100">
            Родословная и история вариаций
          </h3>
        </div>
        <span className="text-xs font-mono text-slate-400">
          ID: {asset.id.slice(0, 8)}...
        </span>
      </div>

      {/* 1. Ancestor Lineage (Root -> Parent) */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
          <span>Цепочка происхождения (Предки)</span>
        </div>

        {ancestors.length === 0 ? (
          <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 text-xs text-slate-400 flex items-center gap-2.5">
            <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
            <span>Это первоначальное (корневое) изображение, созданное напрямую по промпту.</span>
          </div>
        ) : (
          <div className="space-y-2 relative pl-4 border-l-2 border-slate-800">
            {ancestors.map((anc, index) => {
              const isGrandParent = index < ancestors.length - 1;
              return (
                <div
                  key={anc.id}
                  onClick={() => onSelectAsset(anc)}
                  className="group flex items-center justify-between p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800/80 border border-slate-800 hover:border-amber-500/50 cursor-pointer transition-all"
                >
                  <div className="flex items-center gap-3">
                    <img
                      src={anc.thumbnailUrl || anc.url}
                      alt={anc.filename}
                      className="w-12 h-12 object-cover rounded-lg border border-slate-700/60 shrink-0"
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-amber-400 font-medium">
                          {index === 0 ? '👑 Корень' : `v${index + 1} Родитель`}
                        </span>
                        <span className="text-[11px] text-slate-400 font-mono">
                          /{anc.folderPath}
                        </span>
                      </div>
                      <p className="text-xs text-slate-200 line-clamp-1 mt-0.5 max-w-sm">
                        {anc.userPrompt || anc.prompt}
                      </p>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-amber-400 transition-colors" />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 2. Current Asset Node (Active) */}
      <div className="p-4 rounded-xl bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/40 shadow-lg shadow-amber-500/5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <img
              src={asset.thumbnailUrl || asset.url}
              alt={asset.filename}
              className="w-16 h-16 object-cover rounded-xl border border-amber-500/40 shrink-0 shadow-md"
            />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-amber-500 text-slate-950">
                  Текущее изображение
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  {asset.aspectRatio} • {asset.model}
                </span>
              </div>
              <p className="text-xs text-slate-100 font-medium mt-1 leading-snug">
                {asset.userPrompt || asset.prompt}
              </p>
              {asset.style && (
                <span className="inline-block text-[10px] mt-1.5 px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
                  #{asset.style}
                </span>
              )}
            </div>
          </div>

          <button
            onClick={() => onRemixAsset(asset)}
            className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs rounded-lg shadow transition-all flex items-center gap-1.5 shrink-0"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Новый ремикс</span>
          </button>
        </div>
      </div>

      {/* 3. Children / Variations (Descendants) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <CornerDownRight className="w-3.5 h-3.5 text-emerald-400" />
            Прямые потомки и ремиксы ({children.length})
          </span>
        </div>

        {children.length === 0 ? (
          <div className="p-3.5 rounded-xl bg-slate-900/40 border border-slate-800/60 text-xs text-slate-500">
            У этого изображения пока нет ремиксов. Нажмите кнопку «Новый ремикс», чтобы породить вариацию.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {children.map((child) => (
              <div
                key={child.id}
                onClick={() => onSelectAsset(child)}
                className="group flex items-center gap-3 p-2 rounded-xl bg-slate-900 hover:bg-slate-800/80 border border-slate-800 hover:border-emerald-500/50 cursor-pointer transition-all"
              >
                <img
                  src={child.thumbnailUrl || child.url}
                  alt={child.filename}
                  className="w-12 h-12 object-cover rounded-lg border border-slate-700/60 shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <span className="text-[10px] font-mono text-emerald-400 font-medium">
                    Ремикс
                  </span>
                  <p className="text-xs text-slate-200 truncate">
                    {child.userPrompt || child.prompt}
                  </p>
                  <span className="text-[10px] text-slate-500 font-mono">
                    /{child.folderPath}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 4. Batch Siblings */}
      {siblings.length > 0 && (
        <div className="space-y-3 pt-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Родственные вариации из того же батча ({siblings.length})
          </span>
          <div className="grid grid-cols-2 gap-3">
            {siblings.map((sib) => (
              <div
                key={sib.id}
                onClick={() => onSelectAsset(sib)}
                className="group flex items-center gap-3 p-2 rounded-xl bg-slate-900 hover:bg-slate-800/80 border border-slate-800 hover:border-slate-600 cursor-pointer transition-all"
              >
                <img
                  src={sib.thumbnailUrl || sib.url}
                  alt={sib.filename}
                  className="w-12 h-12 object-cover rounded-lg border border-slate-700/60 shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-300 truncate">
                    {sib.userPrompt || sib.prompt}
                  </p>
                  <span className="text-[10px] text-slate-500 font-mono">
                    {sib.aspectRatio}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
