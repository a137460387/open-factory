import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';
export default defineConfig({
  plugins: [
    tailwindcss(),
    react({
      babel: {
        plugins: [['babel-plugin-react-compiler']],
      },
    }),
  ],
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
            if (/\/ai-[^/]+$/.test(normalized) || /\/ai\/[^/]+$/.test(normalized)) return 'editor-core-ai';
            if (/\/editor-core\/(?:src|dist)\/(?:exports\/)?index\.(ts|js)$/.test(normalized)) return 'editor-core-barrel';
            if (/\/(timeline-commands|timeline-scripting|project-health-check)\.(ts|js)$/.test(normalized)) return 'editor-core-bridge';
            if (normalized.includes('/export/') || normalized.includes('/exports/pipeline')) return 'editor-core-export';
            if (/\/(timeline-|clip-groups|keyframes|easing-|render-cache|track-|sequence-|director-|continuity-|sync-|collaboration|touch-|operation-)/.test(normalized)) return 'editor-core-timeline';
            if (/\/(subtitles?\/|subtitle-|data-subtitle|contextual-translation)/.test(normalized)) return 'editor-core-subtitles';
            if (/\/(color-|color\/|scopes\/|style-transfer|lut-|ai-color-)/.test(normalized)) return 'editor-core-color';
            if (/\/(audio-|audio\/|rhythm-|spatial-|beats|music-|ai-loudness)/.test(normalized)) return 'editor-core-audio';
            if (/\/(project\/|archive-encryption)/.test(normalized)) return 'editor-core-project';
            if (/\/(media-|duplicate-media|batch-media|thumbnail-|cover-|content-analysis|frame-|match-frame|selection-|broadcast-|scene-|vfr|smart-rough|storyboard|highlight-|anomaly-|flash-|profiler|complexity-|performance-|tag-|stress-|naming-|quick-|annotation-|distribution|batch-crop)/.test(normalized)) return 'editor-core-media';
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
