import React, { useState } from 'react';
import { X, KeyRound, RefreshCw, Plus, Copy, Check, Shield } from 'lucide-react';
import { ServiceClient } from '../types';
import { createClient, rotateClientKey, toggleClientActive } from '../api';

interface ClientsModalProps {
  clients: ServiceClient[];
  onClientsChanged: () => void;
  onClose: () => void;
}

export const ClientsModal: React.FC<ClientsModalProps> = ({
  clients,
  onClientsChanged,
  onClose,
}) => {
  const [slug, setSlug] = useState('');
  const [name, setName] = useState('');
  const [scopes, setScopes] = useState<string[]>(['media:read', 'media:write']);
  const [issuedKey, setIssuedKey] = useState<{ slug: string; key: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  const toggleScope = (scope: string) => {
    setScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope],
    );
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!slug.trim() || !name.trim()) return;
    setBusy(true);
    try {
      const created = await createClient({ slug, name, scopes });
      if (created.apiKey) {
        setIssuedKey({ slug: created.slug, key: created.apiKey });
      }
      setSlug('');
      setName('');
      onClientsChanged();
    } catch (err: any) {
      alert(err.message || 'Ошибка создания клиента');
    } finally {
      setBusy(false);
    }
  };

  const handleRotate = async (client: ServiceClient) => {
    if (!confirm(`Перевыпустить API-ключ для ${client.slug}? Старый ключ перестанет работать.`)) return;
    setBusy(true);
    try {
      const res = await rotateClientKey(client.id);
      setIssuedKey({ slug: client.slug, key: res.apiKey });
      onClientsChanged();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleToggleActive = async (client: ServiceClient) => {
    setBusy(true);
    try {
      await toggleClientActive(client.id, !client.isActive);
      onClientsChanged();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setBusy(false);
    }
  };

  const copyIssued = () => {
    if (!issuedKey) return;
    navigator.clipboard.writeText(issuedKey.key);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[88vh]">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <KeyRound className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-white">Приложения и API-ключи (X-Media-Api-Key)</h3>
              <p className="text-[11px] text-slate-400">
                Управление доступом для lemon-seasons, smart-botanik, lemon-calendarium и др.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-5 overflow-y-auto">
          {issuedKey && (
            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/40 text-xs">
              <div className="font-semibold text-emerald-300 mb-1">
                Новый API-ключ для {issuedKey.slug} (сохраните, показывается один раз):
              </div>
              <div className="flex items-center gap-2">
                <code className="flex-1 p-2 rounded-lg bg-slate-950 text-emerald-200 font-mono text-[11px] select-all">
                  {issuedKey.key}
                </code>
                <button
                  onClick={copyIssued}
                  className="px-3 py-2 rounded-lg bg-emerald-500 text-slate-950 font-semibold flex items-center gap-1"
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Скопировано' : 'Копировать'}</span>
                </button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {clients.map((c) => (
              <div
                key={c.id}
                className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center justify-between gap-3"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-white">{c.name}</span>
                    <code className="text-[11px] px-1.5 py-0.5 rounded bg-slate-800 text-amber-300">
                      {c.slug}
                    </code>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded ${
                        c.isActive
                          ? 'bg-emerald-500/15 text-emerald-300'
                          : 'bg-rose-500/15 text-rose-300'
                      }`}
                    >
                      {c.isActive ? 'Active' : 'Disabled'}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1 font-mono">
                    Key: {c.apiKeyPrefix} • Scopes: {c.scopes.join(', ')} • Grants: {c.grantsCount ?? 0}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleRotate(c)}
                    disabled={busy}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs flex items-center gap-1"
                    title="Перевыпустить API ключ"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Rotate</span>
                  </button>
                  <button
                    onClick={() => handleToggleActive(c)}
                    disabled={busy}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs"
                  >
                    {c.isActive ? 'Откл.' : 'Вкл.'}
                  </button>
                </div>
              </div>
            ))}
          </div>

          <form
            onSubmit={handleCreate}
            className="p-4 rounded-xl bg-slate-950/50 border border-slate-800 space-y-3"
          >
            <div className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-amber-400" />
              <span>Добавить новое приложение</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="text"
                placeholder="slug (например: blog-app)"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                required
                className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white"
              />
              <input
                type="text"
                placeholder="Название"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white"
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {['media:read', 'media:write', 'media:publish'].map((s) => (
                  <label key={s} className="flex items-center gap-1 text-[11px] text-slate-300">
                    <input
                      type="checkbox"
                      checked={scopes.includes(s)}
                      onChange={() => toggleScope(s)}
                    />
                    <span>{s}</span>
                  </label>
                ))}
              </div>
              <button
                type="submit"
                disabled={busy}
                className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-semibold flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Создать ключ</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
