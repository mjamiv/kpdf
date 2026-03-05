/**
 * Local Browser Storage Provider — Phase 5.2
 *
 * Implements StorageProvider using raw IndexedDB for binary file storage.
 * Path-based key structure: paths like "/documents/file.pdf" map to IndexedDB
 * records with metadata (name, size, lastModified, mimeType) and binary content.
 */

import type { StorageFile, StorageProvider } from './storageProvider';

// ---------------------------------------------------------------------------
// IndexedDB helpers
// ---------------------------------------------------------------------------

const DB_NAME = 'kpdf-storage';
const DB_VERSION = 1;
const STORE_NAME = 'files';

type StoredRecord = {
  path: string;
  name: string;
  size: number;
  lastModified: string;
  mimeType: string;
  data: Uint8Array;
};

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'path' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function withTransaction<T>(
  db: IDBDatabase,
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, mode);
    const store = tx.objectStore(STORE_NAME);
    const request = fn(store);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function getAllRecords(db: IDBDatabase): Promise<StoredRecord[]> {
  return withTransaction(db, 'readonly', (store) => store.getAll());
}

function normalizePath(path: string): string {
  // Ensure leading slash, remove trailing slash
  let p = path.startsWith('/') ? path : '/' + path;
  if (p.length > 1 && p.endsWith('/')) {
    p = p.slice(0, -1);
  }
  return p;
}

function getParentPath(path: string): string {
  const idx = path.lastIndexOf('/');
  if (idx <= 0) return '/';
  return path.slice(0, idx);
}

function getFileName(path: string): string {
  const idx = path.lastIndexOf('/');
  return idx < 0 ? path : path.slice(idx + 1);
}

// ---------------------------------------------------------------------------
// Provider factory
// ---------------------------------------------------------------------------

export function createLocalStorageProvider(): StorageProvider {
  let db: IDBDatabase | null = null;
  let isConnected = false;

  const provider: StorageProvider = {
    id: 'local',
    name: 'Local Storage (IndexedDB)',

    get connected() {
      return isConnected;
    },

    async connect() {
      if (!db) {
        db = await openDB();
      }
      isConnected = true;
    },

    async disconnect() {
      if (db) {
        db.close();
        db = null;
      }
      isConnected = false;
    },

    async list(path: string): Promise<StorageFile[]> {
      if (!db) throw new Error('Not connected');
      const normalized = normalizePath(path);
      const all = await getAllRecords(db);
      return all
        .filter((r) => getParentPath(normalizePath(r.path)) === normalized)
        .map((r) => ({
          path: r.path,
          name: r.name,
          size: r.size,
          lastModified: r.lastModified,
          mimeType: r.mimeType,
        }));
    },

    async read(path: string): Promise<Uint8Array> {
      if (!db) throw new Error('Not connected');
      const normalized = normalizePath(path);
      const record = await withTransaction<StoredRecord | undefined>(db, 'readonly', (store) =>
        store.get(normalized),
      );
      if (!record) throw new Error(`File not found: ${path}`);
      return record.data;
    },

    async write(path: string, data: Uint8Array, mimeType = 'application/octet-stream') {
      if (!db) throw new Error('Not connected');
      const normalized = normalizePath(path);
      const record: StoredRecord = {
        path: normalized,
        name: getFileName(normalized),
        size: data.byteLength,
        lastModified: new Date().toISOString(),
        mimeType,
        data,
      };
      await withTransaction(db, 'readwrite', (store) => store.put(record));
    },

    async delete(path: string) {
      if (!db) throw new Error('Not connected');
      const normalized = normalizePath(path);
      await withTransaction(db, 'readwrite', (store) => store.delete(normalized));
    },

    async exists(path: string): Promise<boolean> {
      if (!db) throw new Error('Not connected');
      const normalized = normalizePath(path);
      const record = await withTransaction<StoredRecord | undefined>(db, 'readonly', (store) =>
        store.get(normalized),
      );
      return record !== undefined;
    },
  };

  return provider;
}
