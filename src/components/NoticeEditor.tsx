import React, { useEffect, useState } from 'react';
import { Loader2, Save, Eye } from 'lucide-react';
import { api } from '../services/api';
import { NoticeCard } from './NoticeModal';

const TITLE_MAX = 80;
const MESSAGE_MAX = 600;

interface NoticeEditorProps {
  /** Avisa o App para já mostrar o novo aviso (sem precisar recarregar) */
  onSaved?: () => void;
}

/**
 * Editor do pop-up de aviso (painel do barbeiro).
 * O que for salvo aqui aparece para todos os clientes na próxima vez que abrirem o app,
 * inclusive para quem já tinha fechado o aviso anterior.
 */
export const NoticeEditor: React.FC<NoticeEditorProps> = ({ onSaved }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');

  useEffect(() => {
    let alive = true;
    api
      .adminGetNotice()
      .then((n) => {
        if (!alive || !n) return;
        setTitle(n.title);
        setMessage(n.message);
        setValidUntil(n.validUntil || '');
        setIsActive(n.isActive);
      })
      .catch((e: any) => alive && setError(e.message || 'Erro ao carregar o aviso.'))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setOk('');
    try {
      await api.adminSaveNotice({ title: title.trim(), message: message.trim(), validUntil, isActive });
      setOk(isActive ? 'Aviso salvo! Os clientes já vão ver o novo pop-up.' : 'Aviso salvo e DESATIVADO: nenhum pop-up será exibido.');
      onSaved?.();
    } catch (err: any) {
      setError(err.message || 'Erro ao salvar o aviso.');
    } finally {
      setSaving(false);
    }
  };

  const field =
    'mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-xs text-white outline-none focus:border-amber-500';

  if (loading) {
    return (
      <div className="py-4 text-center text-xs text-neutral-400">
        <Loader2 className="inline w-4 h-4 animate-spin mr-2" />Carregando aviso...
      </div>
    );
  }

  return (
    <form onSubmit={handleSave} className="space-y-3 text-left">
      <p className="text-[11px] text-neutral-400">
        Escreva o texto do pop-up que aparece quando o cliente abre o app. Ao salvar, ele volta a aparecer para todos.
      </p>

      <label className="block text-[11px] text-neutral-400">
        Título
        <input
          required
          maxLength={TITLE_MAX}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Ex.: Horário Estendido!"
          className={field}
        />
        <span className="mt-0.5 block text-right text-[10px] text-neutral-500">{title.length}/{TITLE_MAX}</span>
      </label>

      <label className="block text-[11px] text-neutral-400">
        Mensagem
        <textarea
          required
          rows={5}
          maxLength={MESSAGE_MAX}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Escreva o aviso para os clientes..."
          className={`${field} resize-y`}
        />
        <span className="mt-0.5 block text-right text-[10px] text-neutral-500">{message.length}/{MESSAGE_MAX}</span>
      </label>

      <div className="grid grid-cols-2 gap-2 items-end">
        <label className="block text-[11px] text-neutral-400">
          Válido até (opcional)
          <input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} className={field} />
        </label>
        <label className="flex items-center gap-2 pb-2 text-[11px] text-neutral-300">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="accent-amber-500" />
          Mostrar o pop-up
        </label>
      </div>
      {validUntil && (
        <button type="button" onClick={() => setValidUntil('')} className="text-[11px] text-neutral-400 underline hover:text-white">
          Remover data de validade
        </button>
      )}

      {/* Pré-visualização */}
      <div className="rounded-xl border border-neutral-800 bg-black/40 p-3">
        <p className="mb-2 inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-neutral-400">
          <Eye className="w-3.5 h-3.5" /> Como o cliente vai ver
        </p>
        <div className="flex justify-center">
          <NoticeCard title={title} message={message} validUntil={validUntil} preview />
        </div>
        {!isActive && <p className="mt-2 text-center text-[11px] text-rose-300">Desativado: o pop-up não será exibido.</p>}
      </div>

      {error && <p className="rounded-lg border border-rose-800/60 bg-rose-950/50 p-2 text-[11px] text-rose-300">{error}</p>}
      {ok && <p className="rounded-lg border border-emerald-800/60 bg-emerald-950/40 p-2 text-[11px] text-emerald-300">{ok}</p>}

      <button
        type="submit"
        disabled={saving}
        className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-amber-500 py-2.5 text-xs font-black uppercase text-black hover:bg-amber-400 disabled:opacity-50"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        Salvar aviso
      </button>
    </form>
  );
};
