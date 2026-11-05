import preact from '@preact/preset-vite';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

export default defineConfig({
  root: 'client',
  plugins: [preact()],
  resolve: {
    alias: {
      '@shared': fileURLToPath(new URL('./shared', import.meta.url)),
      '@bake': fileURLToPath(new URL('./tools/bake/page', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    proxy: { '/api': 'http://localhost:2567' },
    fs: { allow: ['..'] },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    chunkSizeWarningLimit: 2500,
  },
});
