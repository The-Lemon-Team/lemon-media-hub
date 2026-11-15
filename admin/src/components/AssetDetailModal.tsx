import React, { useState, useEffect } from 'react';
import {
  X,
  Heart,
  Sparkles,
  Download,
  Copy,
  Check,
  Trash2,
  GitBranch,
  Info,
  ExternalLink,
  Shield,
  Lock,
  Users,
  Globe,
  Link2,
  RefreshCw,
  Music,
} from 'lucide-react';
import { MediaAsset, AssetLineage, MediaVisibility, ServiceClient } from '../types';
import {
  fetchAssetLineage,
  toggleFavorite,
  deleteAsset,
  updateAssetAccess,
  createSignedUrl,
  reprocessAsset,
} from '../api';
import { LineageTree } from './LineageTree';

interface AssetDetailModalProps {
  asset: MediaAsset;
  clients: ServiceClient[];
  canAiRemix?: boolean;
  onClose: () => void;
  onAssetUpdated: (updated: MediaAsset) => void;
  onAssetDeleted: (id: string) => void;
  onRemix: (asset: MediaAsset) => void;
  onSelectAnotherAsset: (asset: MediaAsset) => void;
}

export const AssetDetailModal: React.FC<AssetDetailModalProps> = ({
  asset,
  clients,
  canAiRemix,
  onClose,
  onAssetUpdated,
  onAssetDeleted,
  onRemix,
  onSelectAnotherAsset,
}) => {
  const [activeTab, setActiveTab] = useState<'info' | 'access' | 'lineage'>('info');
  const [copied, setCopied] = useState(false);
  const [copiedSigned, setCopiedSigned] = useState(false);
  const [lineage, setLineage] = useState<AssetLineage | null>(null);
  const [loadingLineage, setLoadingLineage] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [reprocessing, setReprocessing] = useState(false);

  const [visibility, setVisibility] = useState<MediaVisibility>(asset.visibility);
  const [selectedSlugs, setSelectedSlugs] = useState<string[]>(
    (asset.grants || []).map((g) => g.clientSlug),
  );
  const [savingAccess, setSavingAccess] = useState(false);

  useEffect(() => {
    setVisibility(asset.visibility);
    setSelectedSlugs((asset.grants || []).map((g) => g.clientSlug));
  }, [asset]);

  useEffect(() => {
    let isMounted = true;
    setLoadingLineage(true);
    fetchAssetLineage(asset.id)
      .then((data) => {
        if (isMounted) setLineage(data);
      })
      .catch((err) => console.error(err))
      .finally(() => {
        if (isMounted) setLoadingLineage(false);
      });

    return () => {
      isMounted = false;
    };
  }, [asset.id]);

  const handleCopyPrompt = () => {
    const text = asset.prompt || asset.userPrompt || asset.title || asset.filename;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleToggleFavorite = async () => {
    try {
      const updated = await toggleFavorite(asset.id);
      onAssetUpdated(updated);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Удалить этот медиафайл и все его варианты с диска?')) return;
    setDeleting(true);
    try {
      await deleteAsset(asset.id);
      onAssetDeleted(asset.id);
      onClose();
    } catch {
      alert('Ошибка при удалении');
    } finally {
      setDeleting(false);
    }
  };

  const handleSaveAccess = async () => {
    setSavingAccess(true);
    try {
      const grantsPayload =
        visibility === 'SCOPED'
          ? selectedSlugs.map((clientSlug) => ({ clientSlug, permission: 'READ' as const }))
          : [];
      const updated = await updateAssetAccess(asset.id, visibility, grantsPayload);
      onAssetUpdated(updated);
    } catch (err: any) {
      alert(err.message || 'Ошибка сохранения прав доступа');
    } finally {
      setSavingAccess(false);
    }
  };

  const handleCopySignedUrl = async () => {
    try {
      const res = await createSignedUrl(asset.id, 'auto', 3600);
      const absUrl = `${window.location.origin}${res.relativeUrl}`;
      navigator.clipboard.writeText(absUrl);
      setCopiedSigned(true);
      setTimeout(() => setCopiedSigned(false), 2500);
    } catch (err: any) {
      alert(err.message || 'Не удалось создать signed URL');
    }
  };

  const handleReprocess = async () => {
    setReprocessing(true);
    try {
      const updated = await reprocessAsset(asset.id);
      onAssetUpdated(updated);
    } catch (err: any) {
      alert(err.message || 'Ошибка запуска обработки');
    } finally {
      setReprocessing(false);
    }
  };

  const toggleSlug = (slug: string) => {
    setSelectedSlugs((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug],
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 sm:p-6">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/80">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-800 text-amber-400">
              {asset.kind}
            </span>
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
              /{asset.folderPath}
            </span>
            <span className="text-xs text-slate-400 font-mono truncate max-w-xs">
              {asset.filename}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleToggleFavorite}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
              title="Избранное"
            >
              <Heart className={`w-4 h-4 ${asset.isFavorite ? 'text-rose-500 fill-rose-500' : ''}`} />
            </button>
            {canAiRemix && asset.kind === 'IMAGE' && (
              <button
                onClick={() => onRemix(asset)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs rounded-lg transition-all"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Ремикс</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Split Body */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          {/* Left: Player / Preview Canvas */}
          <div className="md:w-3/5 bg-slate-950 flex flex-col items-center justify-center p-6 overflow-hidden relative group">
            {asset.kind === 'IMAGE' && (
              <img
                src={asset.url}
                alt={asset.title || asset.filename}
                className="max-h-full max-w-full object-contain rounded-lg shadow-2xl"
              />
            )}

            {asset.kind === 'VIDEO' && (
              <video
                src={asset.url}
                poster={asset.thumbnailUrl || undefined}
                controls
                preload="metadata"
                className="max-h-full max-w-full rounded-xl shadow-2xl border border-slate-800 bg-black"
              />
            )}

            {asset.kind === 'AUDIO' && (
              <div className="w-full max-w-md bg-slate-900/90 border border-slate-800 rounded-2xl p-6 space-y-5 shadow-xl">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-cyan-500/15 text-cyan-400 flex items-center justify-center">
                    <Music className="w-6 h-6" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-white truncate">
                      {asset.title || asset.filename}
                    </div>
                    <div className="text-xs text-slate-400 font-mono">
                      {asset.codec || asset.mimeType}{' '}
                      {asset.durationMs ? `• ${(asset.durationMs / 1000).toFixed(1)}s` : ''}
                    </div>
                  </div>
                </div>

                {Array.isArray(asset.waveformPeaks) && asset.waveformPeaks.length > 0 && (
                  <div className="flex items-end gap-1 h-20 bg-slate-950/70 rounded-xl p-3 border border-slate-800/80">
                    {asset.waveformPeaks.map((p, idx) => (
                      <span
                        key={idx}
                        className="flex-1 bg-gradient-to-t from-cyan-500 to-sky-300 rounded-full"
                        style={{ height: `${Math.max(8, p)}%` }}
                      />
                    ))}
                  </div>
                )}

                <audio src={asset.url} controls className="w-full" />
              </div>
            )}

            <div className="absolute bottom-4 right-4 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <a
                href={asset.url}
                target="_blank"
                rel="noreferrer"
                download={asset.filename}
                className="px-3 py-1.5 bg-slate-900/90 backdrop-blur-md text-white rounded-lg text-xs font-medium border border-slate-700 hover:bg-slate-800 flex items-center gap-1.5 shadow"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Скачать</span>
              </a>
              <a
                href={asset.url}
                target="_blank"
                rel="noreferrer"
                className="p-1.5 bg-slate-900/90 backdrop-blur-md text-white rounded-lg border border-slate-700 hover:bg-slate-800 shadow"
                title="Открыть в новой вкладке"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Right: Tabs & Inspector */}
          <div className="md:w-2/5 flex flex-col bg-slate-900 border-l border-slate-800 overflow-hidden">
            <div className="flex border-b border-slate-800 bg-slate-950/40 px-3 pt-2">
              <button
                onClick={() => setActiveTab('info')}
                className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium border-b-2 transition-all cursor-pointer ${
                  activeTab === 'info'
                    ? 'border-amber-400 text-amber-300 font-semibold'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Info className="w-3.5 h-3.5" />
                <span>Инфо</span>
              </button>
              <button
                onClick={() => setActiveTab('access')}
                className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium border-b-2 transition-all cursor-pointer ${
                  activeTab === 'access'
                    ? 'border-amber-400 text-amber-300 font-semibold'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Shield className="w-3.5 h-3.5" />
                <span>Доступ</span>
              </button>
              <button
                onClick={() => setActiveTab('lineage')}
                className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium border-b-2 transition-all cursor-pointer ${
                  activeTab === 'lineage'
                    ? 'border-amber-400 text-amber-300 font-semibold'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <GitBranch className="w-3.5 h-3.5" />
                <span>Родословная</span>
                {lineage && lineage.children.length > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-mono">
                    +{lineage.children.length}
                  </span>
                )}
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {activeTab === 'info' && (
                <div className="space-y-5">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                        {asset.prompt || asset.userPrompt ? 'Промпт / Описание' : 'Название'}
                      </span>
                      <button
                        onClick={handleCopyPrompt}
                        className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1"
                      >
                        {copied ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                            <span className="text-emerald-400">Скопировано</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Копировать</span>
                          </>
                        )}
                      </button>
                    </div>
                    <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 text-xs text-slate-200 leading-relaxed select-text">
                      {asset.userPrompt || asset.prompt || asset.title || asset.filename}
                    </div>
                  </div>

                  <div>
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-2">
                      Технические характеристики
                    </span>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="p-2.5 bg-slate-950/60 rounded-lg border border-slate-800">
                        <span className="text-slate-500 block text-[10px]">Статус обработки</span>
                        <span className="text-slate-200 font-mono font-medium">
                          {asset.processingStatus}
                        </span>
                      </div>
                      <div className="p-2.5 bg-slate-950/60 rounded-lg border border-slate-800">
                        <span className="text-slate-500 block text-[10px]">Размер файла</span>
                        <span className="text-slate-200 font-mono font-medium">
                          {(asset.sizeBytes / 1024).toFixed(1)} KB
                        </span>
                      </div>
                      {(asset.width || asset.height) && (
                        <div className="p-2.5 bg-slate-950/60 rounded-lg border border-slate-800">
                          <span className="text-slate-500 block text-[10px]">Разрешение</span>
                          <span className="text-slate-200 font-mono font-medium">
                            {asset.width} × {asset.height} ({asset.aspectRatio})
                          </span>
                        </div>
                      )}
                      {asset.durationMs && (
                        <div className="p-2.5 bg-slate-950/60 rounded-lg border border-slate-800">
                          <span className="text-slate-500 block text-[10px]">Длительность</span>
                          <span className="text-slate-200 font-mono font-medium">
                            {(asset.durationMs / 1000).toFixed(2)} сек
                          </span>
                        </div>
                      )}
                      {asset.codec && (
                        <div className="p-2.5 bg-slate-950/60 rounded-lg border border-slate-800">
                          <span className="text-slate-500 block text-[10px]">Кодек</span>
                          <span className="text-slate-200 font-mono font-medium">
                            {asset.codec}
                          </span>
                        </div>
                      )}
                      <div className="p-2.5 bg-slate-950/60 rounded-lg border border-slate-800">
                        <span className="text-slate-500 block text-[10px]">Источник</span>
                        <span className="text-slate-200 font-mono font-medium">
                          {asset.sourceApp || asset.model}
                        </span>
                      </div>
                    </div>

                    {asset.processingError && (
                      <div className="mt-2 p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-[11px] text-rose-300 font-mono">
                        {asset.processingError}
                      </div>
                    )}
                  </div>

                  {asset.kind !== 'DOCUMENT' && (
                    <button
                      onClick={handleReprocess}
                      disabled={reprocessing}
                      className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${reprocessing ? 'animate-spin' : ''}`} />
                      <span>Перезапустить обработку (Sharp / FFmpeg)</span>
                    </button>
                  )}

                  <div className="pt-3 border-t border-slate-800/80">
                    <button
                      onClick={handleDelete}
                      disabled={deleting}
                      className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-rose-400 hover:bg-rose-500/10 border border-rose-500/20 text-xs font-medium transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>{deleting ? 'Удаление...' : 'Удалить ассет с диска'}</span>
                    </button>
                  </div>
                </div>
              )}

              {activeTab === 'access' && (
                <div className="space-y-4">
                  <div className="text-xs text-slate-400">
                    Управляйте тем, какие приложения имеют доступ к этому медиа-ресурсу.
                  </div>

                  <div className="space-y-2">
                    {[
                      {
                        id: 'PRIVATE' as MediaVisibility,
                        title: 'PRIVATE — Только админ',
                        desc: 'Скрыто от всех внешних приложений. Доступно только в Admin Studio.',
                        icon: Lock,
                      },
                      {
                        id: 'SCOPED' as MediaVisibility,
                        title: 'SCOPED — Избранные проекты',
                        desc: 'Доступно только отмеченным проектам (X-Media-Api-Key / signed URL).',
                        icon: Users,
                      },
                      {
                        id: 'PUBLIC' as MediaVisibility,
                        title: 'PUBLIC — Публичное медиа',
                        desc: 'Отдаётся без токена для любого клиента и браузера.',
                        icon: Globe,
                      },
                    ].map((opt) => {
                      const Icon = opt.icon;
                      const active = visibility === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setVisibility(opt.id)}
                          className={`w-full p-3 rounded-xl border text-left transition-all ${
                            active
                              ? 'border-amber-500 bg-amber-500/10 text-amber-200'
                              : 'border-slate-800 bg-slate-950/60 text-slate-300 hover:border-slate-700'
                          }`}
                        >
                          <div className="flex items-center gap-2 text-xs font-semibold">
                            <Icon className="w-4 h-4 text-amber-400" />
                            <span>{opt.title}</span>
                          </div>
                          <p className="text-[11px] opacity-75 mt-1">{opt.desc}</p>
                        </button>
                      );
                    })}
                  </div>

                  {visibility === 'SCOPED' && (
                    <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
                      <span className="text-xs font-semibold text-slate-300 block">
                        Проекты с доступом:
                      </span>
                      {clients.map((c) => (
                        <label
                          key={c.id}
                          className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-900 cursor-pointer text-xs"
                        >
                          <div>
                            <span className="font-medium text-slate-200">{c.name}</span>
                            <span className="ml-2 font-mono text-[11px] text-slate-500">
                              {c.slug}
                            </span>
                          </div>
                          <input
                            type="checkbox"
                            checked={selectedSlugs.includes(c.slug)}
                            onChange={() => toggleSlug(c.slug)}
                          />
                        </label>
                      ))}
                    </div>
                  )}

                  <button
                    onClick={handleSaveAccess}
                    disabled={savingAccess}
                    className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-semibold disabled:opacity-50"
                  >
                    {savingAccess ? 'Сохранение...' : 'Сохранить права доступа'}
                  </button>

                  <div className="pt-3 border-t border-slate-800">
                    <button
                      onClick={handleCopySignedUrl}
                      className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium"
                    >
                      <Link2 className="w-3.5 h-3.5 text-sky-400" />
                      <span>
                        {copiedSigned
                          ? 'Signed URL (1ч) скопирован!'
                          : 'Скопировать временную Signed URL (1 ч)'}
                      </span>
                    </button>
                  </div>
                </div>
              )}

              {activeTab === 'lineage' && (
                <div>
                  {loadingLineage ? (
                    <div className="py-12 text-center text-slate-400 text-xs">
                      Загрузка дерева родословной...
                    </div>
                  ) : lineage ? (
                    <LineageTree
                      lineage={lineage}
                      onSelectAsset={onSelectAnotherAsset}
                      onRemixAsset={onRemix}
                    />
                  ) : (
                    <div className="py-12 text-center text-slate-500 text-xs">
                      Нет данных о родословной.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
