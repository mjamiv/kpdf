import { describe, it, expect, vi } from 'vitest';
import { createStorageManager } from './storageProvider';
import type { StorageProvider } from './storageProvider';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMockProvider(id: string, name?: string): StorageProvider {
  return {
    id,
    name: name ?? `Provider ${id}`,
    connected: false,
    connect: vi.fn(async () => { /* noop */ }),
    disconnect: vi.fn(async () => { /* noop */ }),
    list: vi.fn(async () => []),
    read: vi.fn(async () => new Uint8Array()),
    write: vi.fn(async () => { /* noop */ }),
    delete: vi.fn(async () => { /* noop */ }),
    exists: vi.fn(async () => false),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('StorageManager', () => {
  it('registers and retrieves a provider', () => {
    const mgr = createStorageManager();
    const p = makeMockProvider('local');
    mgr.registerProvider(p);

    expect(mgr.getProvider('local')).toBe(p);
  });

  it('lists all registered providers', () => {
    const mgr = createStorageManager();
    mgr.registerProvider(makeMockProvider('a'));
    mgr.registerProvider(makeMockProvider('b'));

    expect(mgr.listProviders()).toHaveLength(2);
  });

  it('returns undefined for unknown provider', () => {
    const mgr = createStorageManager();
    expect(mgr.getProvider('nope')).toBeUndefined();
  });

  it('auto-sets first registered as default', () => {
    const mgr = createStorageManager();
    const p = makeMockProvider('first');
    mgr.registerProvider(p);

    expect(mgr.getDefault()).toBe(p);
  });

  it('does not override default on second registration', () => {
    const mgr = createStorageManager();
    const first = makeMockProvider('first');
    mgr.registerProvider(first);
    mgr.registerProvider(makeMockProvider('second'));

    expect(mgr.getDefault()).toBe(first);
  });

  it('setDefault changes the default provider', () => {
    const mgr = createStorageManager();
    mgr.registerProvider(makeMockProvider('a'));
    const b = makeMockProvider('b');
    mgr.registerProvider(b);
    mgr.setDefault('b');

    expect(mgr.getDefault()).toBe(b);
  });

  it('setDefault throws for unknown provider', () => {
    const mgr = createStorageManager();
    expect(() => mgr.setDefault('nope')).toThrow('not registered');
  });

  it('getDefault returns undefined when no providers registered', () => {
    const mgr = createStorageManager();
    expect(mgr.getDefault()).toBeUndefined();
  });

  it('overwrites provider on re-registration with same id', () => {
    const mgr = createStorageManager();
    mgr.registerProvider(makeMockProvider('a', 'First A'));
    mgr.registerProvider(makeMockProvider('a', 'Second A'));

    expect(mgr.getProvider('a')?.name).toBe('Second A');
    // listProviders may have 1 (Map deduplicates by key)
    expect(mgr.listProviders()).toHaveLength(1);
  });
});
