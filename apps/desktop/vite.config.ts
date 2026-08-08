import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, type Plugin } from 'vite';

/**
 * E2E 专属：冷态预编译首屏懒加载 chunk 的模块图，并门控 dev-server 就绪时机。
 *
 * 背景：Timeline / PreviewCanvas 是 React.lazy（ShellMainArea.tsx），dev server
 * 冷态首次编译其模块图实测约 8.4s，超过 audio-envelope 等 spec 的 5s expect
 * 超时，造成"隔离单跑必挂、全量暖态通过"。且 Timeline 没有就近 Suspense
 * 边界（挂在 App 根 Suspense 下）、冷 chunk 到达后浏览器还要同步解析执行，
 * 期间主线程被阻塞（DevPerfOverlay 实测 FPS 0），clip 渲染刚好错过超时窗口。
 * vite 内置 server.warmup 在服务启动时触发预编译但不阻塞就绪——playwright 的
 * url 探测会在编译完成前通过，测试仍会与编译赛跑。因此这里改为：
 *   1. 服务 listening 后递归 transform 这些 chunk 的模块图（await 到全部完成）；
 *   2. 完成前挂起对根路径 '/' 的响应（playwright webServer 就绪探测），
 *      确保任何测试（含隔离单跑）发起时相关 chunk 已在转换缓存中。
 * 不放宽 spec 超时数值——那只会掩盖组件加载慢的事实。
 * 仅 VITE_E2E=true（playwright webServer 注入）时启用；常规 dev 与
 * 生产构建（rollup 产物，无 vite dev 转换）不受影响。
 */
function e2eTimelineWarmupGate(entries: string[]): Plugin {
  return {
    name: 'e2e-timeline-warmup-gate',
    apply: 'serve',
    configureServer(server) {
      let warmupDone = false;
      const heldNexts: Array<() => void> = [];
      server.middlewares.use((req, _res, next) => {
        if (warmupDone || req.url !== '/') {
          next();
          return;
        }
        heldNexts.push(next);
      });
      server.httpServer?.on('listening', () => {
        void (async () => {
          const startedAt = Date.now();
          try {
            const seen = new Set<string>();
            const walk = async (url: string): Promise<void> => {
              if (seen.has(url)) return;
              seen.add(url);
              await server.transformRequest(url);
              const node = await server.moduleGraph.getModuleByUrl(url);
              const children = node ? Array.from(node.importedModules).map((dep) => dep.url) : [];
              await Promise.all(children.map((child) => walk(child)));
            };
            await Promise.all(
              entries.map((entry) => walk(entry.startsWith('/') ? entry : `/${entry}`)),
            );
            server.config.logger.info(
              `[e2e-warmup] 懒加载 chunk 模块图预热完成（${seen.size} 个模块，${((Date.now() - startedAt) / 1000).toFixed(1)}s）`,
            );
          } catch (error) {
            server.config.logger.error(`[e2e-warmup] 预热失败：${String(error)}`);
          } finally {
            warmupDone = true;
            for (const resume of heldNexts.splice(0)) {
              resume();
            }
          }
        })();
      });
    },
  };
}

const isE2E = process.env.VITE_E2E === 'true';

export default defineConfig(({ mode }) => ({
  define: {
    __DEV_PERF_MONITOR__: mode === 'development',
  },
  plugins: [
    tailwindcss(),
    react({
      babel: {
        plugins: [['babel-plugin-react-compiler']],
      },
    }),
    // E2E 预热门控：预编译首屏会渲染的懒加载 chunk（Timeline、PreviewCanvas），
    // 详见 e2eTimelineWarmupGate 注释。
    ...(isE2E
      ? [
          e2eTimelineWarmupGate([
            'src/components/Timeline/Timeline.tsx',
            'src/components/PreviewCanvas/PreviewCanvas.tsx',
          ]),
        ]
      : []),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  clearScreen: false,
  worker: {
    format: 'es',
  },
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
          if (id.includes('.worker.') || id.includes('worker-')) return undefined;
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
          // Split vendor into smaller chunks
          if (normalized.includes('/node_modules/')) {
            // React ecosystem
            if (normalized.includes('/node_modules/react/') || normalized.includes('/node_modules/react-dom/') || normalized.includes('/node_modules/react-dom/client')) return 'vendor-react';
            // State management
            if (normalized.includes('/node_modules/zustand/') || normalized.includes('/node_modules/use-sync-external-store/')) return 'vendor-state';
            // UI libraries (Radix, Lucide)
            if (normalized.includes('/node_modules/@radix-ui/') || normalized.includes('/node_modules/lucide-react/')) return 'vendor-ui';
            // i18n
            if (normalized.includes('/node_modules/i18next') || normalized.includes('/node_modules/react-i18next/')) return 'vendor-i18n';
            // Tauri
            if (normalized.includes('/node_modules/@tauri-apps/')) return 'vendor-tauri';
            // Other vendor
            return 'vendor-utils';
          }
          if (normalized.includes('/apps/desktop/src/lib/') || normalized.includes('/apps/desktop/src/store/')) return 'app-utils';
          if (normalized.includes('/apps/desktop/src/i18n/')) return 'app-i18n';
          return undefined;
        }
      }
    },
    chunkSizeWarningLimit: 700
  }
}));
