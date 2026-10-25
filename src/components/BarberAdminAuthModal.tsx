import React, { useState, useEffect } from 'react';
import { X, Lock, ShieldAlert, KeyRound, CheckCircle2, QrCode, Loader2, Power, Eye, EyeOff } from 'lucide-react';
import { UserAccount } from '../types/barbershop';
import { api } from '../services/api';

interface BarberAdminAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserAccount | null;
  onLoginSuccess: (user: UserAccount) => void;
  onToggleShopStatus?: () => void;
  isOpenStatus?: boolean;
  onOpenAgenda?: () => void;
}

export const BarberAdminAuthModal: React.FC<BarberAdminAuthModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onLoginSuccess,
  onToggleShopStatus,
  isOpenStatus,
  onOpenAgenda,
}) => {
  const [step, setStep] = useState<'credentials' | '2fa' | 'authenticated'>('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [code, setCode] = useState('');
  const [tempToken, setTempToken] = useState('');

  // 2FA Setup & QR Code
  const [showQRGuide, setShowQRGuide] = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');
  const [secret, setSecret] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const isAlreadyAdmin = currentUser && currentUser.role === 'barber_admin';

  useEffect(() => {
    if (isOpen) {
      if (isAlreadyAdmin) {
        setStep('authenticated');
      } else {
        setStep('credentials');
        setEmail('');
        setPassword('');
        setCode('');
        setErrorMessage('');
      }

      // Carrega dados do QR code do 2FA
      api.getBarber2FASetup().then((res) => {
        if (res.qrCodeDataUrl) setQrCodeDataUrl(res.qrCodeDataUrl);
        if (res.secret) setSecret(res.secret);
      }).catch(() => {});
    }
  }, [isOpen, isAlreadyAdmin]);

  if (!isOpen) return null;

  // Passo 1: Validação de Senha Master
  const handleStep1Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setIsLoading(true);

    try {
      const res = await api.barberLoginStep1({ email, password });
      setTempToken(res.tempToken);
      setStep('2fa');
      setSuccessMessage('Senha administrativa confirmada! Insira o código 2FA do seu aplicativo autenticador.');
    } catch (err: any) {
      setErrorMessage(err.message || 'Credenciais de administrador incorretas.');
    } finally {
      setIsLoading(false);
    }
  };

  // Passo 2: Validação de TOTP (RFC 6238)
  const handleStep2Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setIsLoading(true);

    try {
      const res = await api.barberLoginStep2({ tempToken, code });
      onLoginSuccess(res.user);
      setStep('authenticated');
      setSuccessMessage('Autenticação em Dois Fatores (2FA) validada com sucesso!');
    } catch (err: any) {
      setErrorMessage(err.message || 'Código 2FA incorreto ou expirado.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleOpen = async () => {
    try {
      await api.toggleOpenStatus();
      if (onToggleShopStatus) onToggleShopStatus();
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao alterar status.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-md rounded-3xl border border-amber-500/50 bg-[#121212] p-6 sm:p-8 shadow-2xl text-neutral-100 max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 rounded-xl p-1.5 text-neutral-400 hover:bg-neutral-800 hover:text-white"
          aria-label="Fechar"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Cabeçalho */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-11 h-11 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase tracking-widest text-amber-400">
              Acesso Restrito • Administrador
            </span>
            <h3 className="font-display text-xl font-bold text-white">
              Painel do Leonardo Arruda
            </h3>
          </div>
        </div>

        {errorMessage && (
          <div className="mb-4 rounded-xl bg-rose-950/40 border border-rose-800/50 p-3 text-xs text-rose-300">
            {errorMessage}
          </div>
        )}

        {successMessage && (
          <div className="mb-4 rounded-xl bg-emerald-950/40 border border-emerald-800/50 p-3 text-xs text-emerald-300">
            {successMessage}
          </div>
        )}

        {/* PASSO 1: CREDENCIAIS ADMINISTRATIVAS */}
        {step === 'credentials' && (
          <form onSubmit={handleStep1Submit} className="space-y-4">
            <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 p-3.5 text-xs text-amber-200/90 flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <p>
                Acesso protegido com <strong>Autenticação em 2 Etapas (2FA)</strong> e bloqueio por IP contra força bruta (Etapa 2).
              </p>
            </div>

            <div>
              <label className="text-xs font-semibold text-neutral-300">E-mail Administrativo</label>
              <input
                type="email"
                required
                placeholder="seu.email@admin.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-2.5 text-xs text-white focus:border-amber-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-neutral-300">Senha Master</label>
              <div className="relative mt-1">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-2.5 text-xs text-white focus:border-amber-500 focus:outline-none pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-neutral-400 hover:text-white"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 py-3 text-xs font-black uppercase text-black tracking-wider shadow-lg hover:brightness-110 active:scale-98 transition-all flex items-center justify-center gap-2"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>Avançar para 2FA</span>}
            </button>
          </form>
        )}

        {/* PASSO 2: CÓDIGO 2FA (TOTP) */}
        {step === '2fa' && (
          <form onSubmit={handleStep2Submit} className="space-y-4">
            <div className="text-center py-2">
              <KeyRound className="w-10 h-10 text-amber-400 mx-auto mb-2 animate-bounce" />
              <h4 className="font-display text-sm font-bold text-white">Verificação em Duas Etapas</h4>
              <p className="text-xs text-neutral-400 mt-1">
                Digite o código de 6 dígitos gerado no Google Authenticator ou Authy:
              </p>
            </div>

            <input
              type="text"
              maxLength={6}
              required
              autoFocus
              value={code}
              placeholder="000 000"
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              className="w-full text-center tracking-[0.5em] text-2xl font-mono font-bold rounded-xl border border-amber-500/50 bg-neutral-900 py-3 text-amber-400 focus:border-amber-400 focus:outline-none"
            />

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setStep('credentials')}
                className="flex-1 rounded-xl border border-neutral-800 bg-neutral-900 py-2.5 text-xs font-bold text-neutral-400 hover:text-white"
              >
                Voltar
              </button>
              <button
                type="submit"
                disabled={isLoading || code.length < 6}
                className={`flex-1 rounded-xl py-2.5 text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
                  code.length < 6
                    ? 'bg-neutral-800 text-neutral-500 cursor-not-allowed'
                    : 'bg-gradient-to-r from-amber-500 to-amber-600 text-black shadow-lg hover:brightness-110 active:scale-98'
                }`}
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>Validar 2FA</span>}
              </button>
            </div>

            {/* Alternar Visualização do QR Code do Authenticator */}
            <div className="pt-2 border-t border-neutral-800 text-center">
              {qrCodeDataUrl && (
              <button
                type="button"
                onClick={() => setShowQRGuide(!showQRGuide)}
                className="inline-flex items-center gap-1.5 text-xs text-amber-400 hover:underline"
              >
                <QrCode className="w-3.5 h-3.5" />
                <span>{showQRGuide ? 'Ocultar QR Code' : 'Escanear QR Code no Celular / Chave'}</span>
              </button>
              )}

              {showQRGuide && qrCodeDataUrl && (
                <div className="mt-3 p-4 rounded-2xl bg-neutral-900 border border-neutral-800 space-y-3 animate-fade-in text-center">
                  <p className="text-[11px] text-neutral-300">
                    Abra o <strong>Google Authenticator</strong> no seu celular e escaneie o código abaixo:
                  </p>
                  <img
                    src={qrCodeDataUrl}
                    alt="2FA QR Code"
                    className="mx-auto rounded-xl p-2 bg-white w-44 h-44 shadow-md"
                  />
                  <div className="text-[10px] text-neutral-400">
                    Chave manual: <code className="text-amber-400 font-mono font-bold">{secret}</code>
                  </div>
                </div>
              )}
            </div>
          </form>
        )}

        {/* LOGADO COMO ADMINISTRADOR */}
        {step === 'authenticated' && (
          <div className="space-y-5 text-center py-2 animate-fade-in">
            <div className="w-16 h-16 rounded-full bg-amber-500/20 border-2 border-amber-500 mx-auto flex items-center justify-center text-amber-400">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-amber-400">
                Sessão Administrativa Ativa
              </span>
              <h3 className="font-display text-xl font-bold text-white mt-1">
                Leonardo Arruda
              </h3>
              <p className="text-xs text-neutral-400">Barbeiro & Administrador Responsável</p>
            </div>

            {/* Ação Rápida de Controle: Botão Aberta / Fechada */}
            <div className="rounded-2xl border border-neutral-800 bg-neutral-900/80 p-4 space-y-3 text-left">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-display text-xs font-bold text-white uppercase tracking-wider">
                    Status da Barbearia no App
                  </h4>
                  <p className="text-[11px] text-neutral-400">
                    Altera em tempo real para todos os clientes
                  </p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${
                    isOpenStatus
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                      : 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                  }`}
                >
                  {isOpenStatus ? 'Aberta' : 'Fechada'}
                </span>
              </div>

              <button
                type="button"
                onClick={handleToggleOpen}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-neutral-700 bg-neutral-800 py-2.5 text-xs font-bold text-white hover:border-amber-500 hover:text-amber-300 transition"
              >
                <Power className="w-3.5 h-3.5 text-amber-400" />
                <span>Alternar Status (Aberta ↔ Fechada)</span>
              </button>
            </div>

            {onOpenAgenda && (
              <button
                type="button"
                onClick={onOpenAgenda}
                className="w-full rounded-xl border border-amber-500/60 bg-amber-500/10 py-2.5 text-xs font-black uppercase text-amber-300 hover:bg-amber-500/20"
              >
                📅 Abrir Agenda de Clientes
              </button>
            )}

            <button
              onClick={onClose}
              className="w-full rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 py-2.5 text-xs font-black uppercase text-black"
            >
              Fechar Painel
            </button>
          </div>
        )}
      </div>
    </div>
  );
};