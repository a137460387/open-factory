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
          // editor-core 家族（packages/editor-core 与其 workspace 镜像）合并为单一
          // 'editor-core' 块，不再按文件名正则拆分多个域块。
          //
          // 安全边界（v4.78.0 生产黑屏事故定性，方案 B 回退）：
          // 1. 此前按文件名正则拆出 editor-core-{timeline,subtitles,color,audio,
          //    project,media,export,bridge,barrel,ai} 等块，但包内真实模块图存在
          //    大量跨"域"环（commands/* → 全部域；model/factories → audio/color/media；
          //    域 → model），实测文件级 import 边：兜底块→域 92 条、域→兜底 300+ 条、
          //    域间互引 40+ 条，Rollup 产出 15+ 组 Circular chunk 警告。
          // 2. 多个域文件在模块顶层立即求值常量并访问跨块绑定
          //    （timeline-templates → DEFAULT_COLOR_CORRECTION；subtitle 样式表 →
          //    默认样式），块循环求值时序下直接 TDZ 崩溃：
          //    ReferenceError: Cannot access 'x' before initialization → #root 空。
          // 3. 文件级路由无法打破这些环（一个文件常同时依赖多个域），结构性
          //    脆弱；合并为单块后环回到 chunk 内部，由 Rollup 的模块拓扑排序
          //    保证求值顺序（块级执行序由浏览器 import 决定、Rollup 失去控制，
          //    这正是多块循环爆 TDZ 的机制）。缓存粒度损失可接受（本地 Tauri
          //    桌面加载无网络往返，且 editor-core 单块保留了包级缓存语义）。
          if (normalized.includes('/node_modules/@open-factory/editor-core/') || normalized.includes('/packages/editor-core/')) {
            return 'editor-core';
          }
          // Split vendor into smaller chunks
          if (normalized.includes('/node_modules/')) {
            // React 生态闭包：react / react-dom 及其直接依赖 scheduler 必须同分块
            // （vendor-react），否则 react-dom → scheduler 落入 vendor-utils 会形成
            // vendor-react ↔ vendor-utils 双向分块循环，React 模块体未求值时
            // vendor-utils 内模块级 React 绑定访问即崩溃（v4.78.0 黑屏第一根因，
            // v4.73.0 manualChunks 拆分引入起潜伏，dev server 无分块故 e2e 不拦截）。
            // @tanstack/* 独立成块：其模块级代码（typeof document<"u" ?
            // React.useLayoutEffect : React.useEffect）依赖 React 初始化完成，
            // 独立块对 vendor-react 保持单向依赖（React 不反向依赖 tanstack），
            // 单向即可保证求值顺序安全，且避免 vendor-react 超出 200KB 预算。
            if (
              normalized.includes('/node_modules/react/') ||
              normalized.includes('/node_modules/react-dom/') ||
              normalized.includes('/node_modules/react-dom/client') ||
              normalized.includes('/node_modules/scheduler/')
            ) {
              return 'vendor-react';
            }
            if (normalized.includes('/node_modules/@tanstack/')) {
              return 'vendor-tanstack';
            }
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
