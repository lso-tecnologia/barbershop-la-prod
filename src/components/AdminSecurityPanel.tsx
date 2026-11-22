import React, { useEffect, useState } from 'react';
import { Loader2, UserPlus, Trash2, Smartphone, KeyRound, ShieldCheck, ShieldAlert } from 'lucide-react';
import { api, AdminAccount, TwoFactorQr } from '../services/api';

/**
 * Painel de segurança do barbeiro:
 *  - lista e cadastra outros administradores (cada um com o PRÓPRIO Google Authenticator)
 *  - transfere o 2FA para outro celular
 *  - troca a própria senha
 * Toda ação pede o código atual do autenticador (se alguém roubar a sessão, não consegue mexer aqui).
 */

const input = 'w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-xs text-white outline-none focus:border-amber-500';
const codeInput = `${input} text-center tracking-[0.4em] font-mono text-amber-400`;
const btn = 'w-full inline-flex items-center justify-center gap-2 rounded-lg bg-amber-500 py-2.5 text-xs font-black uppercase text-black hover:bg-amber-400 disabled:opacity-50';
const onlyDigits = (v: string) => v.replace(/\D/g, '').slice(0, 6);

type Tab = 'admins' | 'phone' | 'password';

export const AdminSecurityPanel: React.FC = () => {
  const [tab, setTab] = useState<Tab>('admins');
  const [admins, setAdmins] = useState<AdminAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');

  // Novo admin
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [tempPassword, setTempPassword] = useState('');
  const [code, setCode] = useState('');

  // Troca de celular
  const [qr, setQr] = useState<TwoFactorQr | null>(null);
  const [newPhoneCode, setNewPhoneCode] = useState('');

  // Troca de senha
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const run = async (fn: () => Promise<void>) => {
    setBusy(true); setError(''); setOk('');
    try { await fn(); } catch (e: any) { setError(e.message || 'Erro.'); } finally { setBusy(false); }
  };

  useEffect(() => {
    api.adminListAdmins().then(setAdmins).catch((e) => setError(e.message)).finally(() => setLoading(false));
  }, []);

  const switchTab = (t: Tab) => { setTab(t); setError(''); setOk(''); setCode(''); };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    void run(async () => {
      setAdmins(await api.adminCreateAdmin({ name, email, phone, tempPassword, code }));
      setOk(`Admin cadastrado! Passe para ${name.split(' ')[0]} o e-mail e a senha provisória. No primeiro acesso, ele escaneia o QR Code no celular dele e cria a senha definitiva.`);
      setName(''); setEmail(''); setPhone(''); setTempPassword(''); setCode('');
    });
  };

  const handleRemove = (a: AdminAccount) => {
    const c = window.prompt(`Remover o acesso de ${a.name}?\n\nDigite o código atual do SEU Google Authenticator para confirmar:`);
    if (!c) return;
    void run(async () => {
      setAdmins(await api.adminRemoveAdmin(a.id, onlyDigits(c)));
      setOk(`${a.name} não é mais administrador.`);
    });
  };

  const handleStartPhone = (e: React.FormEvent) => {
    e.preventDefault();
    void run(async () => { setQr(await api.admin2FAStart(code)); setCode(''); });
  };

  const handleConfirmPhone = (e: React.FormEvent) => {
    e.preventDefault();
    void run(async () => {
      const r = await api.admin2FAConfirm(newPhoneCode);
      setQr(null); setNewPhoneCode(''); setOk(r.message);
    });
  };

  const handlePassword = (e: React.FormEvent) => {
    e.preventDefault();
    void run(async () => {
      const r = await api.adminChangePassword({ currentPassword, newPassword, code });
      setCurrentPassword(''); setNewPassword(''); setCode(''); setOk(r.message);
    });
  };

  const tabBtn = (t: Tab, label: string) => (
    <button type="button" onClick={() => switchTab(t)}
      className={`flex-1 rounded-lg py-2 text-[11px] font-bold ${tab === t ? 'bg-amber-500 text-black' : 'bg-neutral-950 text-neutral-400 hover:text-white'}`}>
      {label}
    </button>
  );

  return (
    <div className="space-y-4 text-left">
      <div className="flex gap-1.5">
        {tabBtn('admins', 'Admins')}
        {tabBtn('phone', 'Trocar celular')}
        {tabBtn('password', 'Minha senha')}
      </div>

      {error && <div className="rounded-lg bg-rose-950/40 border border-rose-800/50 p-2.5 text-[11px] text-rose-300">{error}</div>}
      {ok && <div className="rounded-lg bg-emerald-950/40 border border-emerald-800/50 p-2.5 text-[11px] text-emerald-300">{ok}</div>}

      {tab === 'admins' && (
        <>
          {loading ? (
            <p className="text-center text-xs text-neutral-400"><Loader2 className="inline w-4 h-4 animate-spin mr-2" />Carregando...</p>
          ) : (
            <div className="space-y-2">
              {admins.map((a) => (
                <div key={a.id} className="flex items-center gap-2 rounded-xl border border-neutral-800 bg-neutral-950 p-3">
                  {a.has2FA ? <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" /> : <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold text-white">{a.name}{a.isMe && <span className="text-amber-400"> (você)</span>}</p>
                    <p className="truncate text-[11px] text-neutral-400">{a.email} · {a.has2FA ? '2FA ativo' : 'aguardando 1º acesso'}</p>
                  </div>
                  {!a.isMe && (
                    <button type="button" title="Remover admin" disabled={busy} onClick={() => handleRemove(a)}
                      className="rounded-lg p-2 text-rose-400 hover:bg-rose-950/40 disabled:opacity-50"><Trash2 className="w-4 h-4" /></button>
                  )}
                </div>
              ))}
            </div>
          )}

          <form onSubmit={handleCreate} className="space-y-2.5 border-t border-neutral-800 pt-4">
            <h5 className="text-xs font-bold text-white flex items-center gap-1.5"><UserPlus className="w-4 h-4 text-amber-400" /> Cadastrar novo administrador</h5>
            <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome" className={input} />
            <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="E-mail (será o login)" className={input} />
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Telefone (opcional)" className={input} />
            <input required minLength={10} type="text" autoComplete="off" value={tempPassword} onChange={(e) => setTempPassword(e.target.value)} placeholder="Senha provisória (mín. 10 caracteres)" className={input} />
            <label className="block text-[11px] text-neutral-400">Código atual do SEU Google Authenticator
              <input required inputMode="numeric" value={code} onChange={(e) => setCode(onlyDigits(e.target.value))} placeholder="000000" className={`mt-1 ${codeInput}`} />
            </label>
            <button type="submit" disabled={busy || code.length < 6} className={btn}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />} Cadastrar admin
            </button>
          </form>
        </>
      )}

      {tab === 'phone' && !qr && (
        <form onSubmit={handleStartPhone} className="space-y-3">
          <p className="text-[11px] text-neutral-400">
            Use para passar <strong className="text-white">a sua conta</strong> para um celular novo. Você confirma com o código do celular
            ATUAL, escaneia um QR Code novo no outro celular e confirma com o código dele. Só então o celular antigo para de funcionar.
          </p>
          <label className="block text-[11px] text-neutral-400">Código do celular ATUAL
            <input required inputMode="numeric" value={code} onChange={(e) => setCode(onlyDigits(e.target.value))} placeholder="000000" className={`mt-1 ${codeInput}`} />
          </label>
          <button type="submit" disabled={busy || code.length < 6} className={btn}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Smartphone className="w-4 h-4" />} Gerar QR Code para o celular novo
          </button>
        </form>
      )}

      {tab === 'phone' && qr && (
        <form onSubmit={handleConfirmPhone} className="space-y-3 text-center">
          <p className="text-[11px] text-neutral-300">No <strong>celular novo</strong>: Google Authenticator → <strong>+</strong> → <strong>Ler QR code</strong>:</p>
          <img src={qr.qrCodeDataUrl} alt="QR Code do 2FA" className="mx-auto rounded-xl bg-white p-2 w-44 h-44" />
          <p className="text-[10px] text-neutral-500 break-all">Ou digite a chave: <code className="text-amber-400 font-mono">{qr.secret}</code></p>
          <label className="block text-left text-[11px] text-neutral-400">Código que aparece no celular NOVO
            <input required inputMode="numeric" value={newPhoneCode} onChange={(e) => setNewPhoneCode(onlyDigits(e.target.value))} placeholder="000000" className={`mt-1 ${codeInput}`} />
          </label>
          <button type="submit" disabled={busy || newPhoneCode.length < 6} className={btn}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />} Confirmar celular novo
          </button>
          <button type="button" onClick={() => setQr(null)} className="text-[11px] text-neutral-400 hover:text-white">Cancelar (continua valendo o celular atual)</button>
        </form>
      )}

      {tab === 'password' && (
        <form onSubmit={handlePassword} className="space-y-2.5">
          <input required type="password" autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="Senha atual" className={input} />
          <input required minLength={10} type="password" autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Nova senha (mín. 10 caracteres)" className={input} />
          <label className="block text-[11px] text-neutral-400">Código do Google Authenticator
            <input required inputMode="numeric" value={code} onChange={(e) => setCode(onlyDigits(e.target.value))} placeholder="000000" className={`mt-1 ${codeInput}`} />
          </label>
          <button type="submit" disabled={busy || code.length < 6} className={btn}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />} Trocar senha
          </button>
        </form>
      )}
    </div>
  );
};
