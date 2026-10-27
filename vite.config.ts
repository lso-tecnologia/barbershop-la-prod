import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import {VitePWA} from 'vite-plugin-pwa';

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        injectRegister: false, // o registro é feito em src/lib/appUpdate.ts (atualiza sozinho e recarrega na hora certa)
        includeAssets: ['icon.svg', 'apple-touch-icon.png', 'pwa-192x192.png', 'pwa-512x512.png'],
        manifest: {
          id: '/',
          name: 'BARBERSHOP L.A',
          short_name: 'BARBERSHOPLA',
          description: 'PWA oficial da Barbearia BARBERSHOP L.A em Barueri/SP. Agendamento online e serviços premium.',
          theme_color: '#0a0a0a',
          background_color: '#0a0a0a',
          display: 'standalone',
          orientation: 'portrait',
          start_url: '/',
          scope: '/',
          lang: 'pt-BR',
          icons: [
            {
              src: '/pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-maskable-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
<<<<<<< HEAD
          // Remove caches antigos após cada build e ativar a nova versão sem aguardar
          // todas as abas fecharem. registerType:autoUpdate complementa estas opções.
          cleanupOutdatedCaches: true,
          clientsClaim: true,
          skipWaiting: true,
          globPatterns: ['**/*.{js,css,html,ico,png,svg,jpeg,jpg,woff,woff2}'],
          navigateFallbackDenylist: [/^\/api/],
=======
          // Só o "esqueleto" do app (HTML/JS/CSS/ícones) fica pré-carregado.
          // As fotos (jpeg) NÃO entram aqui: carregam sob demanda e ficam em cache com limite (veja runtimeCaching).
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
          globIgnores: ['assets/aistudio/**'],
          cleanupOutdatedCaches: true, // apaga os caches das versões antigas
          skipWaiting: true,           // versão nova assume assim que instala...
          clientsClaim: true,          // ...e controla as abas abertas (o recarregamento é feito em src/lib/appUpdate.ts)
          navigateFallback: '/index.html',
          navigateFallbackDenylist: [/^\/api\//],
          runtimeCaching: [
            // API: nunca vem do cache (agenda, preços e aviso precisam ser sempre atuais)
            {
              urlPattern: ({url}: {url: URL}) => url.pathname.startsWith('/api/'),
              handler: 'NetworkOnly',
            },
            // Fotos do site: mostra a cópia salva e atualiza em segundo plano; no máximo 40 fotos / 30 dias
            {
              urlPattern: ({request, url}: {request: Request; url: URL}) =>
                request.destination === 'image' && url.origin === self.location.origin,
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'bs-images',
                expiration: {maxEntries: 40, maxAgeSeconds: 60 * 60 * 24 * 30},
                cacheableResponse: {statuses: [0, 200]},
              },
            },
            // Fontes do Google
            {
              urlPattern: /^https:\/\/fonts\.(?:googleapis|gstatic)\.com\/.*/i,
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'bs-fonts',
                expiration: {maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365},
                cacheableResponse: {statuses: [0, 200]},
              },
            },
          ],
>>>>>>> 63d70f2 (Corrigindo mapeamento do db.ts para buscar serviços direto do Supabase)
        },
        devOptions: {
          enabled: false,
          type: 'module',
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
