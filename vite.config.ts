import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { viteStaticCopy } from 'vite-plugin-static-copy';

export default defineConfig({
  base: '/',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
    chunkSizeWarningLimit: 3000,
  },
  plugins: [
    react(),
    tailwindcss(),
    viteStaticCopy({
      targets: [
        {
          src: [
            'node_modules/@r-wasm/webr/dist/R.bin.wasm',
            'node_modules/@r-wasm/webr/dist/R.bin.data',
            'node_modules/@r-wasm/webr/dist/R.bin.js',
            'node_modules/@r-wasm/webr/dist/webr-worker.js',
            'node_modules/@r-wasm/webr/dist/webr-serviceworker.js',
            'node_modules/@r-wasm/webr/dist/webr.mjs',
          ],
          dest: 'webr',
        },
      ],
    }),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'ECP Manager',
        short_name: 'ECP Manager',
        description: 'Application de gestion des formations',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        display: 'standalone',
        icons: [
          {
            src: '/icon.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/icon.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        navigateFallback: '/index.html',
        maximumFileSizeToCacheInBytes: 30 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: /\/webr\/.*/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'webr-runtime-cache',
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 90 * 24 * 60 * 60, // 90 jours
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      }
    })
  ],
  resolve: {
    alias: {
      '@': path.resolve(process.cwd(), '.'),
    },
  },
  server: {
    // HMR is disabled in AI Studio via DISABLE_HMR env var.
    // Do not modify—file watching is disabled to prevent flickering during agent edits.
    hmr: process.env.DISABLE_HMR !== 'true',
    // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
    watch: process.env.DISABLE_HMR === 'true' ? null : {},
  },
});
