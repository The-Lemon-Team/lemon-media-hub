import React, { useState } from 'react';
import { X, Upload, Film, Music, Image as ImageIcon, AlertCircle, Globe, Lock, Users } from 'lucide-react';
import { MediaAsset, MediaFolder, MediaVisibility, ServiceClient } from '../types';
import { uploadMediaFile } from '../api';

interface UploadModalProps {
  folders: MediaFolder[];
  clients: ServiceClient[];
  defaultFolder?: string;
  onClose: () => void;
  onSuccess: (created: MediaAsset[]) => void;
}

export const UploadModal: React.FC<UploadModalProps> = ({
  folders,
  clients,
  defaultFolder = 'covers',
  onClose,
  onSuccess,
}) => {
  const [files, setFiles] = useState<File[]>([]);
  const [folderPath, setFolderPath] = useState(
    defaultFolder === 'all' ? 'covers' : defaultFolder,
  );
  const [visibility, setVisibility] = useState<MediaVisibility>('PRIVATE');
  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  const [tagsRaw, setTagsRaw] = useState('');
  const [loading, setLoading] = useState(false);
  const [progressLabel, setProgressLabel] = useState('');
  const [error, setError] = useState<string | null>(null);

  const toggleClient = (slug: string) => {
    setSelectedClients((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug],
    );
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) {
      setFiles(Array.from(e.target.files));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (files.length === 0) return;

    setLoading(true);
    setError(null);
    const tags = tagsRaw
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    const created: MediaAsset[] = [];
    try {
      for (let i = 0; i < files.length; i++) {
        setProgressLabel(`Загрузка ${i + 1} из ${files.length}: ${files[i].name}`);
        const asset = await uploadMediaFile(files[i], {
          folderPath,
          tags,
          visibility,
          allowedClients: visibility === 'SCOPED' ? selectedClients : [],
        });
        created.push(asset);
      }
      onSuccess(created);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Ошибка загрузки');
    } finally {
      setLoading(false);
      setProgressLabel('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl flex flex-col">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center">
              <Upload className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-white">Загрузить медиа (Фото / Видео / Аудио)</h3>
              <p className="text-[11px] text-slate-400">
                Локальное хранение + авто-обработка (Sharp / FFmpeg) + уровни доступа
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

        <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          <label className="block border-2 border-dashed border-slate-700 hover:border-amber-500/60 rounded-xl p-6 text-center cursor-pointer bg-slate-950/50 transition-colors">
            <input
              type="file"
              multiple
              accept="image/*,video/*,audio/*"
              onChange={handleFileChange}
              className="hidden"
            />
            <div className="flex items-center justify-center gap-3 text-slate-400 mb-2">
              <ImageIcon className="w-5 h-5 text-amber-400" />
              <Film className="w-5 h-5 text-rose-400" />
              <Music className="w-5 h-5 text-cyan-400" />
            </div>
            <p className="text-xs font-medium text-slate-200">
              {files.length > 0
                ? `Выбрано файлов: ${files.length} (${files.map((f) => f.name).join(', ')})`
                : 'Нажмите, чтобы выбрать фото, видео или аудио'}
            </p>
            <p className="text-[11px] text-slate-500 mt-1">
              WebP, PNG, JPG, MP4, WebM, MOV, MP3, WAV, OGG, M4A
            </p>
          </label>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Папка</label>
              <select
                value={folderPath}
                onChange={(e) => setFolderPath(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200"
              >
                {folders.map((f) => (
                  <option key={f.id} value={f.path}>
                    {f.name} (/{f.path})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Теги (через запятую)
              </label>
              <input
                type="text"
                value={tagsRaw}
                onChange={(e) => setTagsRaw(e.target.value)}
                placeholder="botanik, hero, podcast"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-2">Уровень доступа</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'PRIVATE' as MediaVisibility, label: 'Private', desc: 'Только админ', icon: Lock },
                { id: 'SCOPED' as MediaVisibility, label: 'Scoped', desc: 'Выбранные проекты', icon: Users },
                { id: 'PUBLIC' as MediaVisibility, label: 'Public', desc: 'Доступно всем', icon: Globe },
              ].map((opt) => {
                const Icon = opt.icon;
                const active = visibility === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setVisibility(opt.id)}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      active
                        ? 'border-amber-500 bg-amber-500/10 text-amber-300'
                        : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 text-xs font-semibold">
                      <Icon className="w-3.5 h-3.5" />
                      <span>{opt.label}</span>
                    </div>
                    <div className="text-[10px] opacity-75 mt-0.5">{opt.desc}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {visibility === 'SCOPED' && (
            <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
              <span className="block text-[11px] font-medium text-slate-400 mb-2">
                Разрешённые проекты:
              </span>
              <div className="flex flex-wrap gap-2">
                {clients.map((c) => {
                  const checked = selectedClients.includes(c.slug);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => toggleClient(c.slug)}
                      className={`px-2.5 py-1.5 rounded-lg text-xs border transition-colors ${
                        checked
                          ? 'border-emerald-500/60 bg-emerald-500/15 text-emerald-300'
                          : 'border-slate-800 bg-slate-900 text-slate-400'
                      }`}
                    >
                      {c.name} ({c.slug})
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs text-slate-300 hover:bg-slate-800"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={loading || files.length === 0}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-slate-950 disabled:opacity-50"
            >
              {loading ? progressLabel || 'Загрузка...' : 'Загрузить в Hub'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
