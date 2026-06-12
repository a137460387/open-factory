import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    host: 'localhost',
    port: 1420,
    strictPort: true,
    watch: {
      ignored: ['**/src-tauri/**']
    }
  },
  build: {
    target: 'es2022',
    outDir: 'dist',
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalized = id.replace(/\\/g, '/');
          if (normalized.includes('/node_modules/@open-factory/editor-core/') || normalized.includes('/packages/editor-core/')) {
            return 'editor-core';
          }
          if (normalized.includes('/node_modules/')) {
            return 'vendor';
          }
          return undefined;
        }
      }
    }
  }
});
