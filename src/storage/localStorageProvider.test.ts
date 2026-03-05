import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createLocalStorageProvider } from './localStorageProvider';

// ---------------------------------------------------------------------------
// Mock IndexedDB
// ---------------------------------------------------------------------------

type StoredRecord = {
  path: string;
  name: string;
  size: number;
  lastModified: string;
  mimeType: string;
  data: Uint8Array;
};

function createMockIndexedDB() {
  const stores = new Map<string, Map<string, StoredRecord>>();

  function getStore(name: string): Map<string, StoredRecord> {
    if (!stores.has(name)) stores.set(name, new Map());
    return stores.get(name)!;
  }

  const mockDB: IDBDatabase = {
    objectStoreNames: {
      contains: (name: string) => stores.has(name),
      length: stores.size,
    } as DOMStringList,
    createObjectStore: (name: string) => {
      stores.set(name, new Map());
      return {} as IDBObjectStore;
    },
    transaction: (storeNames: string | string[], mode?: IDBTransactionMode) => {
      const storeName = typeof storeNames === 'string' ? storeNames : storeNames[0];
      const store = getStore(storeName);

      const mockStore: Partial<IDBObjectStore> = {
        get: (key: IDBValidKey) => {
          const result = store.get(String(key));
          const request = {
            result,
            onsuccess: null as ((this: IDBRequest) => void) | null,
            onerror: null as ((this: IDBRequest) => void) | null,
          } as unknown as IDBRequest;
          setTimeout(() => request.onsuccess?.call(request as IDBRequest, new Event('success')), 0);
          return request;
        },
        getAll: () => {
          const result = Array.from(store.values());
          const request = {
            result,
            onsuccess: null as ((this: IDBRequest) => void) | null,
            onerror: null as ((this: IDBRequest) => void) | null,
          } as unknown as IDBRequest;
          setTimeout(() => request.onsuccess?.call(request as IDBRequest, new Event('success')), 0);
          return request;
        },
        put: (value: StoredRecord) => {
          store.set(value.path, value);
          const request = {
            result: value.path,
            onsuccess: null as ((this: IDBRequest) => void) | null,
            onerror: null as ((this: IDBRequest) => void) | null,
          } as unknown as IDBRequest;
          setTimeout(() => request.onsuccess?.call(request as IDBRequest, new Event('success')), 0);
          return request;
        },
        delete: (key: IDBValidKey) => {
          store.delete(String(key));
          const request = {
            result: undefined,
            onsuccess: null as ((this: IDBRequest) => void) | null,
            onerror: null as ((this: IDBRequest) => void) | null,
          } as unknown as IDBRequest;
          setTimeout(() => request.onsuccess?.call(request as IDBRequest, new Event('success')), 0);
          return request;
        },
      };

      return {
        objectStore: () => mockStore as IDBObjectStore,
        mode: mode ?? 'readonly',
      } as unknown as IDBTransaction;
    },
    close: vi.fn(),
  } as unknown as IDBDatabase;

  const openRequest = {
    result: mockDB,
    onupgradeneeded: null as ((this: IDBOpenDBRequest, ev: IDBVersionChangeEvent) => void) | null,
    onsuccess: null as ((this: IDBOpenDBRequest, ev: Event) => void) | null,
    onerror: null as ((this: IDBOpenDBRequest, ev: Event) => void) | null,
  };

  const mockIndexedDB = {
    open: (_name: string, _version?: number) => {
      setTimeout(() => {
        openRequest.onupgradeneeded?.call(openRequest as unknown as IDBOpenDBRequest, new Event('upgradeneeded') as IDBVersionChangeEvent);
        openRequest.onsuccess?.call(openRequest as unknown as IDBOpenDBRequest, new Event('success'));
      }, 0);
      return openRequest as unknown as IDBOpenDBRequest;
    },
  };

  return { mockIndexedDB, stores, mockDB };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('LocalStorageProvider', () => {
  let originalIndexedDB: typeof globalThis.indexedDB;

  beforeEach(() => {
    originalIndexedDB = globalThis.indexedDB;
    const { mockIndexedDB } = createMockIndexedDB();
    Object.defineProperty(globalThis, 'indexedDB', {
      value: mockIndexedDB,
      writable: true,
      configurable: true,
    });
  });

  beforeEach(() => {
    return () => {
      Object.defineProperty(globalThis, 'indexedDB', {
        value: originalIndexedDB,
        writable: true,
        configurable: true,
      });
    };
  });

  it('has correct id and name', () => {
    const provider = createLocalStorageProvider();
    expect(provider.id).toBe('local');
    expect(provider.name).toContain('Local');
  });

  it('starts disconnected', () => {
    const provider = createLocalStorageProvider();
    expect(provider.connected).toBe(false);
  });

  it('connects and disconnects', async () => {
    const provider = createLocalStorageProvider();
    await provider.connect();
    expect(provider.connected).toBe(true);

    await provider.disconnect();
    expect(provider.connected).toBe(false);
  });

  it('throws when reading without connection', async () => {
    const provider = createLocalStorageProvider();
    await expect(provider.read('/test.pdf')).rejects.toThrow('Not connected');
  });

  it('throws when listing without connection', async () => {
    const provider = createLocalStorageProvider();
    await expect(provider.list('/')).rejects.toThrow('Not connected');
  });

  it('throws when writing without connection', async () => {
    const provider = createLocalStorageProvider();
    await expect(provider.write('/test.pdf', new Uint8Array())).rejects.toThrow('Not connected');
  });

  it('throws when deleting without connection', async () => {
    const provider = createLocalStorageProvider();
    await expect(provider.delete('/test.pdf')).rejects.toThrow('Not connected');
  });

  it('throws when checking existence without connection', async () => {
    const provider = createLocalStorageProvider();
    await expect(provider.exists('/test.pdf')).rejects.toThrow('Not connected');
  });

  it('writes and reads a file', async () => {
    const provider = createLocalStorageProvider();
    await provider.connect();

    const data = new Uint8Array([1, 2, 3, 4]);
    await provider.write('/docs/test.pdf', data, 'application/pdf');

    const result = await provider.read('/docs/test.pdf');
    expect(result).toEqual(data);
  });

  it('checks file existence', async () => {
    const provider = createLocalStorageProvider();
    await provider.connect();

    expect(await provider.exists('/nothing')).toBe(false);

    await provider.write('/something', new Uint8Array([1]));
    expect(await provider.exists('/something')).toBe(true);
  });

  it('lists files in a directory', async () => {
    const provider = createLocalStorageProvider();
    await provider.connect();

    await provider.write('/docs/a.pdf', new Uint8Array([1]), 'application/pdf');
    await provider.write('/docs/b.pdf', new Uint8Array([2, 3]), 'application/pdf');
    await provider.write('/other/c.pdf', new Uint8Array([4]), 'application/pdf');

    const files = await provider.list('/docs');
    expect(files).toHaveLength(2);
    expect(files.map((f) => f.name).sort()).toEqual(['a.pdf', 'b.pdf']);
    expect(files[0].mimeType).toBe('application/pdf');
  });

  it('deletes a file', async () => {
    const provider = createLocalStorageProvider();
    await provider.connect();

    await provider.write('/test.txt', new Uint8Array([1, 2]));
    expect(await provider.exists('/test.txt')).toBe(true);

    await provider.delete('/test.txt');
    expect(await provider.exists('/test.txt')).toBe(false);
  });

  it('throws when reading non-existent file', async () => {
    const provider = createLocalStorageProvider();
    await provider.connect();

    await expect(provider.read('/no-such-file')).rejects.toThrow('File not found');
  });

  it('normalizes paths (adds leading slash)', async () => {
    const provider = createLocalStorageProvider();
    await provider.connect();

    await provider.write('no-slash.txt', new Uint8Array([1]));
    expect(await provider.exists('/no-slash.txt')).toBe(true);
  });

  it('lists root directory', async () => {
    const provider = createLocalStorageProvider();
    await provider.connect();

    await provider.write('/root-file.txt', new Uint8Array([1]));
    const files = await provider.list('/');
    expect(files).toHaveLength(1);
    expect(files[0].name).toBe('root-file.txt');
  });
});
