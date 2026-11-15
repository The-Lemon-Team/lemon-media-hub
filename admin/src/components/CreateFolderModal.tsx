import React, { useState } from 'react';
import { X, FolderPlus, AlertCircle } from 'lucide-react';
import { CreateFolderDto, MediaFolder } from '../types';
import { createFolder } from '../api';

interface CreateFolderModalProps {
  onClose: () => void;
  onSuccess: (newFolder: MediaFolder) => void;
}

const COLOR_PRESETS = [
  '#f59e0b', // amber
  '#10b981', // emerald
  '#38bdf8', // sky
  '#a855f7', // purple
  '#f43f5e', // rose
  '#6366f1', // indigo
];

export const CreateFolderModal: React.FC<CreateFolderModalProps> = ({
  onClose,
  onSuccess,
}) => {
  const [name, setName] = useState('');
  const [path, setPath] = useState('');
  const [color, setColor] = useState(COLOR_PRESETS[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleNameChange = (val: string) => {
    setName(val);
    // Simple translit/slug generator for convenience
    const slug = val
      .toLowerCase()
      .trim()
      .replace(/[\s_]+/g, '-')
      .replace(/[^a-z0-9-]/g, '');
    if (!path || path === slug.slice(0, -1)) {
      setPath(slug);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !path.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const dto: CreateFolderDto = {
        name: name.trim(),
        path: path.trim().toLowerCase(),
        color,
        icon: 'folder',
      };

      const folder = await createFolder(dto);
      onSuccess(folder);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Ошибка создания папки');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/80">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <FolderPlus className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-white">Создать новую папку</h3>
              <p className="text-[11px] text-slate-400">
                Каталог для хранения медиафайлов и генераций
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

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              Название папки <span className="text-amber-400">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="Например: Промо-материалы 2026"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              className="w-full p-2.5 bg-slate-950 text-slate-200 text-xs rounded-xl border border-slate-800 focus:outline-none focus:border-amber-500 transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              Системный путь (slug) <span className="text-amber-400">*</span>
            </label>
            <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs">
              <span className="text-slate-500 font-mono">uploads/</span>
              <input
                type="text"
                required
                placeholder="promo-2026"
                value={path}
                onChange={(e) => setPath(e.target.value)}
                className="w-full bg-transparent text-amber-300 font-mono focus:outline-none ml-1"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              Цветовая метка
            </label>
            <div className="flex items-center gap-2.5">
              {COLOR_PRESETS.map((c) => (
                <button
                  type="button"
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-7 h-7 rounded-full transition-transform ${
                    color === c ? 'scale-125 ring-2 ring-white' : 'hover:scale-110 opacity-70 hover:opacity-100'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

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
              disabled={loading || !name.trim() || !path.trim()}
              className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs rounded-xl shadow-md transition-all disabled:opacity-50"
            >
              {loading ? 'Создание...' : 'Создать папку'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
