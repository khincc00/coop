import { defineConfig } from 'vite';

export default defineConfig({
  // main.js uses top-level await while loading assets
  build: { target: 'esnext' },
});
