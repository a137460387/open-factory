import type { VideoPreset } from './video-presets';

const DB_NAME = 'open-factory-ltx-video';
const DB_VERSION = 3;
const STORE_NAME = 'generation-history';
const PRESET_STORE_NAME = 'presets';
const TASK_PROGRESS_STORE = 'task-progress';

/** Open the IndexedDB database */
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB not available'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('status', 'status', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
      if (!db.objectStoreNames.contains(PRESET_STORE_NAME)) {
        const presetStore = db.createObjectStore(PRESET_STORE_NAME, { keyPath: 'id' });
        presetStore.createIndex('isBuiltIn', 'isBuiltIn', { unique: false });
      }
      if (!db.objectStoreNames.contains(TASK_PROGRESS_STORE)) {
        const progressStore = db.createObjectStore(TASK_PROGRESS_STORE, { keyPath: 'taskId' });
        progressStore.createIndex('status', 'status', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// ---------------------------------------------------------------------------
// Preset CRUD
// ---------------------------------------------------------------------------

/** Save a video preset (create or update) */
export async function savePreset(preset: VideoPreset): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PRESET_STORE_NAME, 'readwrite');
    const store = tx.objectStore(PRESET_STORE_NAME);
    const request = store.put(preset);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
  });
}

/** Get all user-created presets (excludes built-in) */
export async function getUserPresets(): Promise<VideoPreset[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PRESET_STORE_NAME, 'readonly');
    const store = tx.objectStore(PRESET_STORE_NAME);
    const request = store.getAll();
    request.onsuccess = () => {
      const presets = (request.result as VideoPreset[]).filter((p) => !p.isBuiltIn);
      resolve(presets);
    };
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
  });
}

/** Delete a user preset by ID */
export async function deletePreset(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PRESET_STORE_NAME, 'readwrite');
    const store = tx.objectStore(PRESET_STORE_NAME);
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
  });
}

// ---------------------------------------------------------------------------
// Task Progress Persistence
// ---------------------------------------------------------------------------

/** Persisted generation task progress entry */
export interface TaskProgressEntry {
  taskId: string;
  status: string;
  progress: number;
  stage: string;
  prompt: string;
  videoPath?: string;
  error?: string;
  startedAt: number;
  updatedAt: number;
}

/** Save or update task progress */
export async function saveTaskProgress(entry: TaskProgressEntry): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(TASK_PROGRESS_STORE, 'readwrite');
    const store = tx.objectStore(TASK_PROGRESS_STORE);
    const request = store.put(entry);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
  });
}

/** Get all active (non-terminal) task progress entries */
export async function getActiveTaskProgress(): Promise<TaskProgressEntry[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(TASK_PROGRESS_STORE, 'readonly');
    const store = tx.objectStore(TASK_PROGRESS_STORE);
    const request = store.getAll();
    request.onsuccess = () => {
      const entries = (request.result as TaskProgressEntry[]).filter(
        (e) => e.status === 'running' || e.status === 'starting',
      );
      resolve(entries);
    };
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
  });
}

/** Delete a task progress entry */
export async function deleteTaskProgress(taskId: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(TASK_PROGRESS_STORE, 'readwrite');
    const store = tx.objectStore(TASK_PROGRESS_STORE);
    const request = store.delete(taskId);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
  });
}
