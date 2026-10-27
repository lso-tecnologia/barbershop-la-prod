/**
 * Atualização do PWA sem ficar preso em cache antigo.
 *
 * Como funciona:
 *  1. O service worker (gerado pelo vite-plugin-pwa) usa skipWaiting + clientsClaim: assim que existe
 *     uma versão nova ele assume sozinho.
 *  2. Aqui o app procura versão nova ao abrir, ao voltar para o app (aba/janela volta ao foco),
 *     ao reconectar e a cada 15 minutos.
 *  3. Quando a versão nova assume, a página recarrega sozinha — na hora se o app acabou de abrir,
 *     ou quando o cliente sair do app (para não interromper um agendamento/pagamento em andamento).
 *  4. Escape manual: botão "Atualizar app" no rodapé e o endereço  /?limpar-cache  (apaga tudo e recarrega).
 */

const CHECK_EVERY_MS = 15 * 60 * 1000;
const FRESH_LAUNCH_MS = 20 * 1000;

let reloading = false;
const reloadOnce = () => {
  if (reloading) return;
  reloading = true;
  window.location.reload();
};

/** Apaga service workers e caches deste site e recarrega (não apaga login nem dados do cliente). */
export async function forceRefreshApp(): Promise<void> {
  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch {
    /* mesmo com erro, recarrega */
  }
  // Remove o parâmetro ?limpar-cache da URL antes de recarregar
  const url = new URL(window.location.href);
  url.searchParams.delete('limpar-cache');
  window.location.replace(url.pathname + url.search + url.hash);
}

export function setupAppUpdates(): void {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

  // Rota de emergência: abrir  https://SEU-SITE/?limpar-cache
  if (new URLSearchParams(window.location.search).has('limpar-cache')) {
    void forceRefreshApp();
    return;
  }

  // O service worker só existe no build de produção
  if (!import.meta.env.PROD) return;

  const hadController = !!navigator.serviceWorker.controller;
  let firstControl = !hadController;

  // Versão nova assumiu o controle -> recarrega para usar os arquivos novos
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (firstControl) {
      // Primeira instalação do app neste aparelho: não precisa recarregar
      firstControl = false;
      return;
    }
    if (performance.now() < FRESH_LAUNCH_MS || document.visibilityState === 'hidden') {
      reloadOnce();
      return;
    }
    // Cliente está usando o app: espera ele sair da tela para recarregar
    const onHide = () => {
      if (document.visibilityState === 'hidden') {
        document.removeEventListener('visibilitychange', onHide);
        reloadOnce();
      }
    };
    document.addEventListener('visibilitychange', onHide);
  });

  const register = () => {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/', updateViaCache: 'none' })
      .then((reg) => {
        const check = () => {
          if (navigator.onLine) reg.update().catch(() => {});
        };
        setInterval(check, CHECK_EVERY_MS);
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') check();
        });
        window.addEventListener('online', check);
      })
      .catch((err) => console.warn('Service worker não registrado:', err));
  };

  if (document.readyState === 'complete') register();
  else window.addEventListener('load', register, { once: true });
}
