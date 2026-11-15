import React, { useState } from 'react';
import { X, Sparkles, GitBranch, AlertCircle, Folder } from 'lucide-react';
import { MediaAsset, MediaFolder, RemixImageDto } from '../types';
import { remixImage } from '../api';

interface RemixModalProps {
  sourceAsset: MediaAsset;
  folders: MediaFolder[];
  onClose: () => void;
  onSuccess: (newAssets: MediaAsset[]) => void;
}

const STYLE_PRESETS = [
  { id: 'cinematic', label: '🎬 Cinematic' },
  { id: 'cyberpunk', label: '🌆 Киберпанк' },
  { id: 'watercolor', label: '🖌️ Акварель' },
  { id: 'anime', label: '⛩️ Anime' },
  { id: 'digital art', label: '🎨 Digital Art' },
  { id: 'minimalist', label: '⚪ Минимализм' },
];

export const RemixModal: React.FC<RemixModalProps> = ({
  sourceAsset,
  folders,
  onClose,
  onSuccess,
}) => {
  const [instruction, setInstruction] = useState('');
  const [style, setStyle] = useState('cyberpunk');
  const [folderPath, setFolderPath] = useState('remixes');
  const [count, setCount] = useState(2);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!instruction.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const dto: RemixImageDto = {
        sourceAssetId: sourceAsset.id,
        instruction: instruction.trim(),
        style,
        aspectRatio: sourceAsset.aspectRatio || '16:9',
        folderPath,
        count,
      };

      const res = await remixImage(dto);
      if (res && res.items) {
        onSuccess(res.items);
        onClose();
      }
    } catch (err: any) {
      setError(err.message || 'Ошибка выполнения ремикса');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/80">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <GitBranch className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-white">
                Image-to-Image Ремикс & Родословная
              </h3>
              <p className="text-[11px] text-slate-400">
                Мультимодальная трансформация композиции через Gemini Vision + Flux AI
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Source Image Banner */}
        <div className="p-3 bg-slate-950/70 border-b border-slate-800/80 flex items-center gap-3">
          <img
            src={sourceAsset.thumbnailUrl || sourceAsset.url}
            alt={sourceAsset.filename}
            className="w-14 h-14 object-cover rounded-xl border border-slate-700/80 shrink-0"
          />
          <div className="flex-1 min-w-0">
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-medium">
              Родительский ассет #{sourceAsset.id.slice(0, 8)}
            </span>
            <p className="text-xs text-slate-200 truncate mt-1">
              {sourceAsset.userPrompt || sourceAsset.prompt || sourceAsset.filename}
            </p>
            <span className="text-[10px] text-slate-400 font-mono">
              Формат: {sourceAsset.aspectRatio} • /{sourceAsset.folderPath}
            </span>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {/* Transformation Instruction */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              Инструкция трансформации <span className="text-amber-400">*</span>
            </label>
            <textarea
              rows={3}
              required
              placeholder="Например: Перенеси эту сцену в футуристичный неоновый город ночью, добавь отражения в лужах и дождь..."
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              className="w-full p-3 bg-slate-950 text-slate-200 text-xs rounded-xl border border-slate-800 focus:outline-none focus:border-amber-500 resize-none leading-relaxed transition-colors"
            />
          </div>

          {/* Style Chips */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              Новый стиль ремикса
            </label>
            <div className="flex flex-wrap gap-1.5">
              {STYLE_PRESETS.map((st) => (
                <button
                  type="button"
                  key={st.id}
                  onClick={() => setStyle(st.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    style === st.id
                      ? 'bg-emerald-500 text-slate-950 shadow-sm font-semibold'
                      : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-700/60'
                  }`}
                >
                  {st.label}
                </button>
              ))}
            </div>
          </div>

          {/* Settings: Target Folder & Count */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                Папка для потомков
              </label>
              <div className="relative">
                <select
                  value={folderPath}
                  onChange={(e) => setFolderPath(e.target.value)}
                  className="w-full appearance-none bg-slate-950 text-slate-200 text-xs rounded-xl px-3 py-2.5 border border-slate-800 focus:outline-none focus:border-amber-500 transition-colors"
                >
                  {folders.map((f) => (
                    <option key={f.id} value={f.path}>
                      📁 {f.name} (/{f.path})
                    </option>
                  ))}
                </select>
                <Folder className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                Количество вариаций
              </label>
              <div className="grid grid-cols-4 gap-1.5">
                {[1, 2, 3, 4].map((num) => (
                  <button
                    type="button"
                    key={num}
                    onClick={() => setCount(num)}
                    className={`py-2 rounded-xl text-xs font-mono font-semibold transition-all ${
                      count === num
                        ? 'bg-emerald-500 text-slate-950 shadow-sm'
                        : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {num}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Submit */}
          <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={loading || !instruction.trim()}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-semibold text-xs rounded-xl shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {loading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  <span>Vision анализ и создание потомков...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Породить {count} {count === 1 ? 'ремикс' : 'ремикса'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
