import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  clearScreen: false,
  optimizeDeps: {
    esbuildOptions: {
      target: 'es2022',
    },
  },
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
            if (/\/ai-[^/]+$/.test(normalized)) return 'editor-core-ai';
            if (/\/editor-core\/(?:src|dist)\/index\.(ts|js)$/.test(normalized)) return 'editor-core-barrel';
            if (/\/(timeline-commands|timeline-scripting|project-health-check)\.(ts|js)$/.test(normalized)) return 'editor-core-bridge';
            if (normalized.includes('/export/')) return 'editor-core-export';
            return 'editor-core';
          }
          if (normalized.includes('/node_modules/')) return 'vendor';
          if (normalized.includes('/apps/desktop/src/lib/') || normalized.includes('/apps/desktop/src/store/')) return 'app-utils';
          if (normalized.includes('/apps/desktop/src/i18n/')) return 'app-i18n';
          return undefined;
        }
      }
    },
    chunkSizeWarningLimit: 700
  }
});
