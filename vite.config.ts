import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import designTokens from './src/styles/designTokens.json';

export default defineConfig({
  plugins: [
    {
      name: 'soliloquio-brand-metadata',
      transformIndexHtml(html) {
        return html.replaceAll('__SOLILOQUIO_THEME_COLOR__', designTokens.bg);
      }
    },
    react(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Soliloquio',
        short_name: 'Soliloquio',
        description: 'A teleprompter for your soliloquy. Private, offline, with controller support.',
        lang: 'en',
        display: 'standalone',
        orientation: 'any',
        start_url: '/',
        background_color: designTokens.bg,
        theme_color: designTokens.bg,
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icon-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,webmanifest}'],
        globIgnores: ['**/8bitdo-*.webp', '**/dualshock-*.webp', '**/xbox-*.webp'],
        runtimeCaching: [
          {
            urlPattern: /\/assets\/(?:8bitdo-|dualshock-|xbox-).*\.webp$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'controller-guides',
              expiration: { maxEntries: 4, maxAgeSeconds: 60 * 60 * 24 * 365 }
            }
          }
        ],
        navigateFallback: '/index.html',
        cleanupOutdatedCaches: true,
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024
      }
    })
  ],
  build: {
    target: 'es2020'
  },
  preview: {
    allowedHosts: ['soli.vondiego.com', 'tele.vondiego.com']
  }
});
