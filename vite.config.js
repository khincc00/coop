import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  // main.js uses top-level await while loading assets
  base: './',
  build: {
    target: 'esnext',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        warzone: resolve(__dirname, 'warzone/index.html'),
      },
    },
  },
});
