const DB_NAME = 'open-factory-ltx-video';
const DB_VERSION = 1;
const STORE_NAME = 'generation-history';

/** Generation history entry stored in IndexedDB */
export interface GenerationHistoryEntry {
  id: string;
  prompt: string;
  negativePrompt?: string;
  imagePath?: string;
  numFrames: number;
  resolution: number;
  fps: number;
  steps: number;
  cfgScale: number;
  seed?: number;
  status: 'completed' | 'failed' | 'canceled';
  videoPath?: string;
  error?: string;
  durationMs?: number;
  createdAt: number;
}

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
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/** Save a generation history entry */
export async function saveGenerationEntry(
  entry: GenerationHistoryEntry
): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.put(entry);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
  });
}

/** Get all generation history entries, sorted by creation time (newest first) */
export async function getGenerationHistory(): Promise<GenerationHistoryEntry[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const index = store.index('createdAt');
    const request = index.openCursor(null, 'prev');
    const entries: GenerationHistoryEntry[] = [];

    request.onsuccess = () => {
      const cursor = request.result;
      if (cursor) {
        entries.push(cursor.value);
        cursor.continue();
      } else {
        resolve(entries);
      }
    };
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
  });
}

/** Get a single generation history entry by ID */
export async function getGenerationEntry(
  id: string
): Promise<GenerationHistoryEntry | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
  });
}

/** Delete a generation history entry */
export async function deleteGenerationEntry(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
  });
}

/** Clear all generation history */
export async function clearGenerationHistory(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
  });
}
