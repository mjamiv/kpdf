/**
 * Cloud Storage Abstraction — Phase 5.2
 *
 * Provides a StorageProvider interface that can be backed by any storage
 * backend (IndexedDB, cloud services, etc.). The StorageManager coordinates
 * multiple providers and allows switching between them.
 *
 * Integration with App.tsx:
 *   const storageManager = createStorageManager();
 *   storageManager.registerProvider(createLocalStorageProvider());
 *   storageManager.setDefault('local');
 *   // Use storageManager in <StorageBrowser /> component
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type StorageFile = {
  path: string;
  name: string;
  size: number;
  lastModified: string;
  mimeType: string;
};

export type StorageProvider = {
  id: string;
  name: string;
  connected: boolean;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  list(path: string): Promise<StorageFile[]>;
  read(path: string): Promise<Uint8Array>;
  write(path: string, data: Uint8Array, mimeType?: string): Promise<void>;
  delete(path: string): Promise<void>;
  exists(path: string): Promise<boolean>;
};

// ---------------------------------------------------------------------------
// StorageManager
// ---------------------------------------------------------------------------

export type StorageManager = {
  registerProvider(provider: StorageProvider): void;
  getProvider(id: string): StorageProvider | undefined;
  listProviders(): StorageProvider[];
  setDefault(id: string): void;
  getDefault(): StorageProvider | undefined;
};

export function createStorageManager(): StorageManager {
  const providers = new Map<string, StorageProvider>();
  let defaultId: string | null = null;

  return {
    registerProvider(provider: StorageProvider) {
      providers.set(provider.id, provider);
      // Auto-set first registered provider as default
      if (defaultId === null) {
        defaultId = provider.id;
      }
    },

    getProvider(id: string) {
      return providers.get(id);
    },

    listProviders() {
      return Array.from(providers.values());
    },

    setDefault(id: string) {
      if (!providers.has(id)) {
        throw new Error(`Storage provider "${id}" is not registered.`);
      }
      defaultId = id;
    },

    getDefault() {
      return defaultId ? providers.get(defaultId) : undefined;
    },
  };
}
