import React, { useState } from 'react';
import { X, User, Mail, Phone, Lock, CheckCircle2, ArrowRight, ShieldCheck, LogOut, Loader2, KeyRound } from 'lucide-react';
import { UserAccount } from '../types/barbershop';
import { api } from '../services/api';

interface ClientAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserAccount | null;
  onLoginSuccess: (user: UserAccount) => void;
  onLogout: () => void;
}

export const ClientAuthModal: React.FC<ClientAuthModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onLoginSuccess,
  onLogout,
}) => {
  const [activeTab, setActiveTab] = useState<'login' | 'register' | 'forgot' | 'reset'>('login');

  // Form states
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Sempre que a janela abre ou fecha, reinicia para a tela de login inicial
  React.useEffect(() => {
    if (isOpen) {
      setActiveTab('login');
      setErrorMessage('');
      setSuccessMessage('');
      setResetToken('');
      setNewPassword('');
      setGeneratedCode(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Format phone helper (11) 9XXXX-XXXX
  const handlePhoneChange = (val: string) => {
    const numbers = val.replace(/\D/g, '');
    let formatted = numbers;
    if (numbers.length > 2) {
      formatted = `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
    }
    if (numbers.length > 7) {
      formatted = `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`;
    }
    setPhone(formatted);
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setIsLoading(true);

    try {
      const res = await api.login({
        loginIdentifier: email,
        password,
      });

      localStorage.setItem('barbershop_logged_client', JSON.stringify(res.user));
      onLoginSuccess(res.user);
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Falha no login. Verifique suas credenciais.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (password.length < 6) {
      setErrorMessage('A senha deve ter no mínimo 6 caracteres.');
      return;
    }

    setIsLoading(true);

    try {
      const res = await api.register({
        name,
        email,
        phone,
        password,
      });

      localStorage.setItem('barbershop_logged_client', JSON.stringify(res.user));
      onLoginSuccess(res.user);
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Falha no cadastro.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setIsLoading(true);

    try {
      const res = await api.forgotPassword(email);
      if (res.previewToken) {
        setGeneratedCode(res.previewToken);
        setResetToken(res.previewToken);
        setSuccessMessage(`Código gerado com sucesso: ${res.previewToken}`);
      } else {
        setSuccessMessage('Instruções geradas com sucesso!');
      }
      setActiveTab('reset');
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao processar solicitação.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setIsLoading(true);

    try {
      await api.resetPassword({
        token: resetToken,
        newPassword,
      });
      setSuccessMessage('Senha alterada com sucesso! Entre com sua nova senha.');
      setActiveTab('login');
      setPassword(newPassword);
    } catch (err: any) {
      setErrorMessage(err.message || 'Código inválido ou expirado.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-md rounded-3xl border border-amber-500/40 bg-[#121212] p-6 sm:p-8 shadow-2xl text-neutral-100">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 rounded-xl p-1.5 text-neutral-400 hover:bg-neutral-800 hover:text-white"
          aria-label="Fechar"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Se o usuário já está logado */}
        {currentUser ? (
          <div className="text-center space-y-5 py-4">
            <div className="w-16 h-16 rounded-full bg-amber-500/20 border-2 border-amber-500 mx-auto flex items-center justify-center text-amber-400">
              <User className="w-8 h-8" />
            </div>

            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-amber-400">
                {currentUser.role === 'barber_admin' ? 'Barbeiro Administrador' : 'Cliente Cadastrado'}
              </span>
              <h3 className="font-display text-xl font-bold text-white mt-1">
                {currentUser.name}
              </h3>
              <p className="text-xs text-neutral-400 mt-0.5">{currentUser.email}</p>
              <p className="text-xs text-neutral-400">{currentUser.phone}</p>
            </div>

            <div className="rounded-2xl border border-neutral-800 bg-neutral-900/80 p-4 text-xs text-neutral-300 text-left space-y-2">
              <div className="flex items-center gap-2 text-amber-400 font-semibold">
                <ShieldCheck className="w-4 h-4" />
                <span>Sessão Protegida por Token JWT</span>
              </div>
              <p className="text-[11px] text-neutral-400">
                Seus agendamentos e dados estão vinculados com total segurança e criptografia no banco de dados.
              </p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="flex-1 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 py-3 text-xs font-bold uppercase text-black"
              >
                Continuar no App
              </button>
              <button
                onClick={async () => {
                  await api.logout();
                  onLogout();
                  onClose();
                }}
                className="flex items-center justify-center gap-1.5 rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-3 text-xs font-bold text-rose-400 hover:bg-rose-950/20"
              >
                <LogOut className="w-4 h-4" />
                <span>Sair</span>
              </button>
            </div>
          </div>
        ) : (
          <div>
            {/* Cabeçalho */}
            <div className="flex items-center gap-3 mb-6">
              <div className="w-11 h-11 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
                <User className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-amber-400">
                  Área do Cliente • BARBERSHOP L.A
                </span>
                <h3 className="font-display text-xl font-bold text-white">
                  Identificação Segura
                </h3>
              </div>
            </div>

            {/* Abas Entrar / Criar Conta */}
            {activeTab !== 'forgot' && activeTab !== 'reset' && (
              <div className="flex rounded-xl bg-neutral-900 p-1 mb-5 border border-neutral-800">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('login');
                    setErrorMessage('');
                  }}
                  className={`flex-1 rounded-lg py-2 text-xs font-bold uppercase tracking-wider transition-all ${
                    activeTab === 'login'
                      ? 'bg-amber-500 text-black shadow-md'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  Entrar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('register');
                    setErrorMessage('');
                  }}
                  className={`flex-1 rounded-lg py-2 text-xs font-bold uppercase tracking-wider transition-all ${
                    activeTab === 'register'
                      ? 'bg-amber-500 text-black shadow-md'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  Criar Conta
                </button>
              </div>
            )}

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

            {/* Formulário de Login */}
            {activeTab === 'login' && (
              <form onSubmit={handleLoginSubmit} className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5 mb-1">
                    <Mail className="w-3.5 h-3.5 text-amber-400" />
                    <span>E-mail</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="seuemail@exemplo.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-2.5 text-xs text-white focus:border-amber-500 focus:outline-none"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-amber-400" />
                      <span>Senha</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab('forgot');
                        setErrorMessage('');
                      }}
                      className="text-[11px] text-amber-400 hover:underline"
                    >
                      Esqueceu a senha?
                    </button>
                  </div>
                  <input
                    type="password"
                    required
                    placeholder="Sua senha secreta"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-2.5 text-xs text-white focus:border-amber-500 focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 py-3 text-xs font-black uppercase text-black tracking-wider shadow-lg hover:brightness-110 active:scale-98 transition-all flex items-center justify-center gap-2"
                >
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>Entrar na Conta</span>}
                </button>
              </form>
            )}

            {/* Formulário de Cadastro */}
            {activeTab === 'register' && (
              <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
                <div>
                  <label className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5 mb-1">
                    <User className="w-3.5 h-3.5 text-amber-400" />
                    <span>Nome Completo</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Carlos Oliveira"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-2.5 text-xs text-white focus:border-amber-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5 mb-1">
                    <Phone className="w-3.5 h-3.5 text-amber-400" />
                    <span>Telefone WhatsApp (com DDD)</span>
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="(11) 98888-8888"
                    value={phone}
                    onChange={(e) => handlePhoneChange(e.target.value)}
                    className="w-full rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-2.5 text-xs text-white focus:border-amber-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5 mb-1">
                    <Mail className="w-3.5 h-3.5 text-amber-400" />
                    <span>E-mail</span>
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="seuemail@exemplo.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-2.5 text-xs text-white focus:border-amber-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5 mb-1">
                    <Lock className="w-3.5 h-3.5 text-amber-400" />
                    <span>Senha (mínimo 6 caracteres)</span>
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="Crie uma senha segura"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-2.5 text-xs text-white focus:border-amber-500 focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 py-3 text-xs font-black uppercase text-black tracking-wider shadow-lg hover:brightness-110 active:scale-98 transition-all flex items-center justify-center gap-2"
                >
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>Cadastrar Conta</span>}
                </button>
              </form>
            )}

            {/* Esqueci a Senha */}
            {activeTab === 'forgot' && (
              <form onSubmit={handleForgotSubmit} className="space-y-4">
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-200">
                  <p className="font-semibold text-amber-400 mb-1">Recuperação de Senha</p>
                  <p className="text-[11px] text-neutral-300">
                    Informe o e-mail cadastrado para gerar o código seguro de recuperação da sua conta.
                  </p>
                </div>

                <div>
                  <label className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5 mb-1">
                    <Mail className="w-3.5 h-3.5 text-amber-400" />
                    <span>Seu E-mail Cadastrado</span>
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="seuemail@exemplo.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-2.5 text-xs text-white focus:border-amber-500 focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 py-3 text-xs font-black uppercase text-black tracking-wider shadow-lg hover:brightness-110 active:scale-98 transition-all flex items-center justify-center gap-2"
                >
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>Gerar Código de Recuperação</span>}
                </button>

                <div className="flex flex-col gap-2 pt-1 text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('login');
                      setErrorMessage('');
                    }}
                    className="text-xs text-neutral-400 hover:text-white"
                  >
                    ← Lembra da sua senha? Fazer login
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('register');
                      setErrorMessage('');
                    }}
                    className="text-xs text-amber-400/90 hover:underline"
                  >
                    Não tem conta? Criar conta agora
                  </button>
                </div>
              </form>
            )}

            {/* Redefinição com Código */}
            {activeTab === 'reset' && (
              <form onSubmit={handleResetSubmit} className="space-y-4">
                {generatedCode ? (
                  <div className="rounded-xl border border-amber-500/50 bg-amber-500/15 p-3.5 text-xs text-amber-200">
                    <div className="flex items-center gap-2 font-bold text-amber-400 mb-1">
                      <KeyRound className="w-4 h-4" />
                      <span>Código de Recuperação Gerado</span>
                    </div>
                    <div className="mt-2 flex items-center justify-center bg-black/60 rounded-lg p-2.5 border border-amber-500/40">
                      <span className="text-xl font-mono font-bold tracking-widest text-amber-400 select-all">
                        {generatedCode}
                      </span>
                    </div>
                    <p className="mt-2 text-[11px] text-neutral-300">
                      ℹ️ O código seguro já foi preenchido no campo abaixo para sua comodidade. Crie sua nova senha agora.
                    </p>
                  </div>
                ) : (
                  <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-3 text-xs text-neutral-300">
                    Insira o código de 6 dígitos que você recebeu e cadastre sua nova senha.
                  </div>
                )}

                <div>
                  <label className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5 mb-1">
                    <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                    <span>Código de Redefinição</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: ABC123"
                    value={resetToken}
                    onChange={(e) => setResetToken(e.target.value.toUpperCase())}
                    className="w-full uppercase tracking-widest font-mono text-center text-sm font-bold rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-2.5 text-white focus:border-amber-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5 mb-1">
                    <Lock className="w-3.5 h-3.5 text-amber-400" />
                    <span>Nova Senha (mínimo 6 caracteres)</span>
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="Digite sua nova senha"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-2.5 text-xs text-white focus:border-amber-500 focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 py-3 text-xs font-black uppercase text-black tracking-wider shadow-lg hover:brightness-110 active:scale-98 transition-all flex items-center justify-center gap-2"
                >
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>Salvar Nova Senha</span>}
                </button>

                <div className="flex flex-col gap-2 pt-1 text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('forgot');
                      setErrorMessage('');
                    }}
                    className="text-xs text-neutral-400 hover:text-white"
                  >
                    ← Não recebeu? Solicitar outro código
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('login');
                      setErrorMessage('');
                    }}
                    className="text-xs text-amber-400/90 hover:underline"
                  >
                    Voltar para o login
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
