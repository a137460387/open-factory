import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { OpenFactoryClient } from './client.js';
import type { ProjectConfig, Track, Effect, ExportProgress } from './types.js';

/**
 * React context for OpenFactory SDK
 */
const OpenFactoryContext = createContext<OpenFactoryClient | null>(null);

/**
 * Provider component for OpenFactory SDK
 */
export function OpenFactoryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(() => new OpenFactoryClient());

  useEffect(() => {
    return () => client.dispose();
  }, [client]);

  return (
    <OpenFactoryContext.Provider value={client}>
      {children}
    </OpenFactoryContext.Provider>
  );
}

/**
 * Hook to get the OpenFactory client
 */
export function useOpenFactory(): OpenFactoryClient {
  const client = useContext(OpenFactoryContext);
  if (!client) {
    throw new Error('useOpenFactory must be used within OpenFactoryProvider');
  }
  return client;
}

/**
 * Hook to manage project state
 */
export function useProject() {
  const client = useOpenFactory();
  const [config, setConfig] = useState<ProjectConfig | null>(client.project.getConfig());
  const [dirty, setDirty] = useState(client.project.isDirty());

  useEffect(() => {
    const unsub = client.on('project:loaded', () => {
      setConfig(client.project.getConfig());
      setDirty(client.project.isDirty());
    });
    const unsub2 = client.on('project:saved', () => {
      setDirty(client.project.isDirty());
    });
    return () => { unsub(); unsub2(); };
  }, [client]);

  const create = useCallback(
    (cfg: ProjectConfig) => client.project.create(cfg),
    [client],
  );
  const save = useCallback(() => client.project.save(), [client]);
  const update = useCallback(
    (updates: Partial<ProjectConfig>) => client.project.update(updates),
    [client],
  );

  return { config, dirty, create, save, update };
}

/**
 * Hook to manage timeline state
 */
export function useTimeline() {
  const client = useOpenFactory();
  const [tracks, setTracks] = useState<Track[]>(client.timeline.getTracks());

  const refresh = useCallback(() => {
    setTracks(client.timeline.getTracks());
  }, [client]);

  useEffect(() => {
    const unsub = client.on('timeline:changed', refresh);
    return unsub;
  }, [client, refresh]);

  const addTrack = useCallback(
    (name: string, type: Track['type']) => {
      const result = client.timeline.addTrack(name, type);
      refresh();
      return result;
    },
    [client, refresh],
  );

  const addClip = useCallback(
    (trackId: string, sourceId: string, startTime: number, endTime: number) => {
      const result = client.timeline.addClip(trackId, sourceId, startTime, endTime);
      refresh();
      return result;
    },
    [client, refresh],
  );

  return { tracks, addTrack, addClip, refresh };
}

/**
 * Hook to manage effects
 */
export function useEffects() {
  const client = useOpenFactory();
  const [effects, setEffects] = useState<Effect[]>(client.effects.getAll());

  const refresh = useCallback(() => {
    setEffects(client.effects.getAll());
  }, [client]);

  useEffect(() => {
    const unsub = client.on('effect:applied', refresh);
    return unsub;
  }, [client, refresh]);

  const apply = useCallback(
    (name: string, type: string, params: Record<string, unknown>) => {
      const result = client.effects.apply(name, type, params);
      refresh();
      return result;
    },
    [client, refresh],
  );

  return { effects, apply, refresh };
}

/**
 * Hook to track export progress
 */
export function useExportProgress() {
  const client = useOpenFactory();
  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const unsub = client.on('export:started', () => setExporting(true));
    const unsub2 = client.on('export:progress', (e) => setProgress(e.payload as ExportProgress));
    const unsub3 = client.on('export:completed', () => {
      setExporting(false);
      setProgress(null);
    });
    const unsub4 = client.on('export:error', () => {
      setExporting(false);
      setProgress(null);
    });
    return () => { unsub(); unsub2(); unsub3(); unsub4(); };
  }, [client]);

  return { progress, exporting };
}
