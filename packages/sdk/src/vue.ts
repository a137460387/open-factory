import { inject, ref, onUnmounted, type InjectionKey, type App, type Ref } from 'vue';
import { OpenFactoryClient } from './client.js';
import type { ProjectConfig, Track, Effect, ExportProgress } from './types.js';

/**
 * Injection key for OpenFactory client
 */
export const OpenFactoryKey: InjectionKey<OpenFactoryClient> = Symbol('OpenFactory');

/**
 * Vue plugin for OpenFactory SDK
 */
export const OpenFactoryPlugin = {
  install(app: App) {
    const client = new OpenFactoryClient();
    app.provide(OpenFactoryKey, client);
    app.config.globalProperties.$openFactory = client;
  },
};

/**
 * Composable to get the OpenFactory client
 */
export function useOpenFactory(): OpenFactoryClient {
  const client = inject(OpenFactoryKey);
  if (!client) {
    throw new Error('useOpenFactory requires OpenFactoryPlugin to be installed');
  }
  return client;
}

/**
 * Composable to manage project state
 */
export function useProject() {
  const client = useOpenFactory();
  const config: Ref<ProjectConfig | null> = ref(client.project.getConfig());
  const dirty = ref(client.project.isDirty());

  const unsub1 = client.on('project:loaded', () => {
    config.value = client.project.getConfig();
    dirty.value = client.project.isDirty();
  });
  const unsub2 = client.on('project:saved', () => {
    dirty.value = client.project.isDirty();
  });
  onUnmounted(() => { unsub1(); unsub2(); });

  return {
    config,
    dirty,
    create: (cfg: ProjectConfig) => client.project.create(cfg),
    save: () => client.project.save(),
    update: (updates: Partial<ProjectConfig>) => client.project.update(updates),
  };
}

/**
 * Composable to manage timeline state
 */
export function useTimeline() {
  const client = useOpenFactory();
  const tracks: Ref<Track[]> = ref(client.timeline.getTracks());

  const refresh = () => {
    tracks.value = client.timeline.getTracks();
  };

  const unsub = client.on('timeline:changed', refresh);
  onUnmounted(unsub);

  return {
    tracks,
    addTrack: (name: string, type: Track['type']) => {
      const result = client.timeline.addTrack(name, type);
      refresh();
      return result;
    },
    addClip: (trackId: string, sourceId: string, startTime: number, endTime: number) => {
      const result = client.timeline.addClip(trackId, sourceId, startTime, endTime);
      refresh();
      return result;
    },
    refresh,
  };
}

/**
 * Composable to manage effects
 */
export function useEffects() {
  const client = useOpenFactory();
  const effects: Ref<Effect[]> = ref(client.effects.getAll());

  const refresh = () => {
    effects.value = client.effects.getAll();
  };

  const unsub = client.on('effect:applied', refresh);
  onUnmounted(unsub);

  return {
    effects,
    apply: (name: string, type: string, params: Record<string, unknown>) => {
      const result = client.effects.apply(name, type, params);
      refresh();
      return result;
    },
    refresh,
  };
}

/**
 * Composable to track export progress
 */
export function useExportProgress() {
  const client = useOpenFactory();
  const progress: Ref<ExportProgress | null> = ref(null);
  const exporting = ref(false);

  const unsub1 = client.on('export:started', () => { exporting.value = true; });
  const unsub2 = client.on('export:progress', (e) => { progress.value = e.payload as ExportProgress; });
  const unsub3 = client.on('export:completed', () => { exporting.value = false; progress.value = null; });
  const unsub4 = client.on('export:error', () => { exporting.value = false; progress.value = null; });
  onUnmounted(() => { unsub1(); unsub2(); unsub3(); unsub4(); });

  return { progress, exporting };
}
