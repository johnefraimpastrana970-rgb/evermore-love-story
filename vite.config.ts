import { defineConfig } from 'vite';
import { authorPlugin } from './tools/vite-author';

export default defineConfig(({ mode }) => ({
  base: './',
  // `npm run author` only: the local save API for author.html (never part of a build).
  plugins: mode === 'author' ? [authorPlugin(process.cwd())] : [],
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: { manualChunks: { phaser: ['phaser'] } },
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
}) as any);
