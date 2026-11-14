import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// The browser imports only the data-free types module of the engine – never its index (which bundles the answers).
const typesAlias = { find: /^@arena\/types$/, replacement: fileURLToPath(new URL('../../packages/engine/src/types.ts', import.meta.url)) };


// Game 12 public types (the market model stays on the server).
const ceoAlias = { find: /^@arena\/ceo$/, replacement: fileURLToPath(new URL('../../packages/engine/src/ceo/types.ts', import.meta.url)) };

// Game 4 public types (cases, truths and source biases stay on the server).
const mdAlias = { find: /^@arena\/md$/, replacement: fileURLToPath(new URL('../../packages/engine/src/md/types.ts', import.meta.url)) };

// Round-sim framework and Game 2 public types (hidden models stay on the server).
const rsAlias = { find: /^@arena\/rs$/, replacement: fileURLToPath(new URL('../../packages/engine/src/rs/types.ts', import.meta.url)) };
const croAlias = { find: /^@arena\/cro$/, replacement: fileURLToPath(new URL('../../packages/engine/src/cro/types.ts', import.meta.url)) };
const adAlias = { find: /^@arena\/ad$/, replacement: fileURLToPath(new URL('../../packages/engine/src/ad/types.ts', import.meta.url)) };
const pdAlias = { find: /^@arena\/pd$/, replacement: fileURLToPath(new URL('../../packages/engine/src/pd/types.ts', import.meta.url)) };
const pwAlias = { find: /^@arena\/pw$/, replacement: fileURLToPath(new URL('../../packages/engine/src/pw/types.ts', import.meta.url)) };
const wrAlias = { find: /^@arena\/wr$/, replacement: fileURLToPath(new URL('../../packages/engine/src/wr/types.ts', import.meta.url)) };
const ssAlias = { find: /^@arena\/ss$/, replacement: fileURLToPath(new URL('../../packages/engine/src/ss/types.ts', import.meta.url)) };

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: [typesAlias, ceoAlias, mdAlias, rsAlias, pwAlias, croAlias, adAlias, pdAlias, wrAlias, ssAlias] },
  server: {
    port: 5174,
    strictPort: true,
    proxy: { '/api': { target: 'http://127.0.0.1:8090', changeOrigin: false } },
  },
  preview: {
    port: 4173,
    proxy: { '/api': { target: 'http://127.0.0.1:8090', changeOrigin: false } },
  },
  build: {
    target: 'es2022',
    sourcemap: false,
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks: {
          firebase: ['firebase/app', 'firebase/firestore'],
          react: ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
});
