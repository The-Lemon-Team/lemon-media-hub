import React, { useState } from 'react';
import { X, Sparkles, Folder, Check, AlertCircle } from 'lucide-react';
import { MediaFolder, GenerateImageBatchDto } from '../types';
import { generateImages } from '../api';

interface GenerateModalProps {
  folders: MediaFolder[];
  defaultFolder?: string;
  onClose: () => void;
  onSuccess: (newAssets: any[]) => void;
}

const STYLE_PRESETS = [
  { id: 'ai-neural', label: '🧠 AI / Нейросеть' },
  { id: 'cyber-security', label: '🛡️ Security / SOC' },
  { id: 'changelog-blueprint', label: '⚙️ Changelog / Релиз' },
  { id: 'podcast-neon', label: '🎙️ IT Подкаст' },
  { id: 'isometric-tech', label: '🧊 3D Изометрия / Cloud' },
  { id: 'silicon-hardware', label: '💻 Чипы / Hardware' },
  { id: 'terminal-retro', label: '📟 Терминал / Код' },
  { id: 'abstract-data', label: '📊 Big Data / Граф' },
  { id: 'cinematic', label: '🎬 Cinematic' },
  { id: 'photorealistic', label: '📷 Фото' },
  { id: 'minimalist', label: '📐 Минимализм' },
  { id: 'cyberpunk', label: '🌆 Киберпанк' },
];

const RATIO_OPTIONS = [
  { id: '16:9', label: '16:9', desc: 'Пейзаж / Обложки' },
  { id: '1:1', label: '1:1', desc: 'Квадрат / Аватарки' },
  { id: '9:16', label: '9:16', desc: 'Портрет / Сторис' },
  { id: '4:3', label: '4:3', desc: 'Классика' },
];

export const GenerateModal: React.FC<GenerateModalProps> = ({
  folders,
  defaultFolder = 'covers',
  onClose,
  onSuccess,
}) => {
  const [prompt, setPrompt] = useState('');
  const [style, setStyle] = useState('cinematic');
  const [aspectRatio, setAspectRatio] = useState('16:9');
  const [folderPath, setFolderPath] = useState(defaultFolder);
  const [count, setCount] = useState(2);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const dto: GenerateImageBatchDto = {
        prompt: prompt.trim(),
        style,
        aspectRatio,
        folderPath,
        count,
      };

      const res = await generateImages(dto);
      if (res && res.items) {
        onSuccess(res.items);
        onClose();
      }
    } catch (err: any) {
      setError(err.message || 'Ошибка генерации изображения');
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
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-white">
                Новая генерация (Flux AI)
              </h3>
              <p className="text-[11px] text-slate-400">
                Создание батча изображений и сохранение в DAM каталог
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {/* Prompt Input */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              Промпт для изображения <span className="text-amber-400">*</span>
            </label>
            <textarea
              rows={3}
              required
              placeholder="Например: Уютное осеннее кафе в горах с мягким утренним светом и чашкой капучино..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="w-full p-3 bg-slate-950 text-slate-200 text-xs rounded-xl border border-slate-800 focus:outline-none focus:border-amber-500 resize-none leading-relaxed transition-colors"
            />
          </div>

          {/* Style Chips */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              Художественный стиль
            </label>
            <div className="flex flex-wrap gap-1.5">
              {STYLE_PRESETS.map((st) => (
                <button
                  type="button"
                  key={st.id}
                  onClick={() => setStyle(st.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    style === st.id
                      ? 'bg-amber-500 text-slate-950 shadow-sm font-semibold'
                      : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-700/60'
                  }`}
                >
                  {st.label}
                </button>
              ))}
            </div>
          </div>

          {/* Aspect Ratio */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              Соотношение сторон
            </label>
            <div className="grid grid-cols-4 gap-2">
              {RATIO_OPTIONS.map((ratio) => (
                <button
                  type="button"
                  key={ratio.id}
                  onClick={() => setAspectRatio(ratio.id)}
                  className={`p-2.5 rounded-xl border text-center transition-all ${
                    aspectRatio === ratio.id
                      ? 'border-amber-500 bg-amber-500/10 text-amber-300'
                      : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
                  }`}
                >
                  <span className="block text-xs font-mono font-bold">
                    {ratio.label}
                  </span>
                  <span className="block text-[10px] text-slate-500 mt-0.5">
                    {ratio.desc}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Settings: Folder & Variations Count */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            {/* Folder Destination */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                Папка назначения
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

            {/* Candidate Count */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                Количество вариаций (батч)
              </label>
              <div className="grid grid-cols-4 gap-1.5">
                {[1, 2, 3, 4].map((num) => (
                  <button
                    type="button"
                    key={num}
                    onClick={() => setCount(num)}
                    className={`py-2 rounded-xl text-xs font-mono font-semibold transition-all ${
                      count === num
                        ? 'bg-amber-500 text-slate-950 shadow-sm'
                        : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {num}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Footer Submit */}
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
              disabled={loading || !prompt.trim()}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-semibold text-xs rounded-xl shadow-md shadow-amber-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {loading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  <span>Генерация {count} {count === 1 ? 'картинки' : 'картинок'}...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Сгенерировать</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
