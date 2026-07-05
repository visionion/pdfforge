import { defineConfig } from 'vite';
import wasm from 'vite-plugin-wasm';

// Served at the apex of the subdomain editpdf.visionion.dev, so base is '/'.
export default defineConfig({
  base: '/',
  plugins: [wasm()],
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
