import { defineConfig } from 'vite';
import wasm from 'vite-plugin-wasm';
import { VitePWA } from 'vite-plugin-pwa';

// Served at the apex of the subdomain editpdf.visionion.dev, so base is '/'.
export default defineConfig({
  base: '/',
  plugins: [
    wasm(),
    VitePWA({
      registerType: 'autoUpdate',
      // Use the hand-written public/manifest.webmanifest.
      manifest: false,
      injectRegister: 'auto',
      workbox: {
        // Precache the app shell (incl. the pdf.js worker) for offline use.
        globPatterns: ['**/*.{js,mjs,css,html,svg,wasm}'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        // Never precache the big font/cmap trees — cache them at runtime.
        globIgnores: ['**/pdfjs/**'],
        runtimeCaching: [
          {
            // Tesseract core + language data (loaded from jsDelivr on demand).
            urlPattern: /^https:\/\/cdn\.jsdelivr\.net\/.*/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'ocr-cdn',
              expiration: { maxEntries: 40, maxAgeSeconds: 60 * 60 * 24 * 30, purgeOnQuotaError: true },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // pdf.js standard fonts + CJK cmaps (same-origin, immutable).
            urlPattern: /\/pdfjs\/.*/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'pdfjs-assets',
              expiration: { maxEntries: 300, purgeOnQuotaError: true },
            },
          },
        ],
      },
    }),
  ],
  build: {
    target: 'esnext',
    sourcemap: false,
  },
  worker: {
    format: 'es',
  },
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['tests/unit/**/*.test.ts'],
  },
});
