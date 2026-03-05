import { describe, it, expect, vi } from 'vitest';
import { createPluginManager } from './pluginApi';
import type { Plugin, PluginAPI, ExportFormatPlugin, PanelPlugin } from './pluginApi';
import type { Annotation } from '../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMockAPI(overrides: Partial<PluginAPI> = {}): PluginAPI {
  return {
    getAnnotations: vi.fn(() => []),
    addAnnotation: vi.fn(),
    removeAnnotation: vi.fn(),
    getCurrentPage: vi.fn(() => 1),
    navigateToPage: vi.fn(),
    registerTool: vi.fn(),
    registerExportFormat: vi.fn(),
    registerPanel: vi.fn(),
    showNotification: vi.fn(),
    getDocumentInfo: vi.fn(() => ({ fingerprint: 'abc', pageCount: 5, fileName: 'test.pdf' })),
    ...overrides,
  };
}

function makePlugin(id: string, hooks: Partial<Plugin> = {}): Plugin {
  return {
    id,
    name: `Plugin ${id}`,
    version: '1.0.0',
    description: 'Test plugin',
    author: 'test',
    ...hooks,
  };
}

const sampleAnnotation: Annotation = {
  id: 'a1',
  zIndex: 1,
  type: 'text',
  x: 0.5,
  y: 0.5,
  text: 'Hello',
  fontSize: 0.02,
  color: '#ff0000',
  author: 'tester',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  locked: false,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PluginManager', () => {
  describe('register / unregister', () => {
    it('registers a plugin and lists it', () => {
      const mgr = createPluginManager(makeMockAPI());
      const p = makePlugin('p1');
      mgr.register(p);

      expect(mgr.listPlugins()).toHaveLength(1);
      expect(mgr.getPlugin('p1')).toBe(p);
    });

    it('throws on duplicate registration', () => {
      const mgr = createPluginManager(makeMockAPI());
      mgr.register(makePlugin('p1'));
      expect(() => mgr.register(makePlugin('p1'))).toThrow('already registered');
    });

    it('unregisters a plugin', () => {
      const mgr = createPluginManager(makeMockAPI());
      mgr.register(makePlugin('p1'));
      mgr.unregister('p1');
      expect(mgr.listPlugins()).toHaveLength(0);
      expect(mgr.getPlugin('p1')).toBeUndefined();
    });

    it('unregister calls onDeactivate if active', () => {
      const deactivate = vi.fn();
      const mgr = createPluginManager(makeMockAPI());
      mgr.register(makePlugin('p1', { onDeactivate: deactivate }));
      mgr.activate('p1');
      mgr.unregister('p1');
      expect(deactivate).toHaveBeenCalledOnce();
    });

    it('unregister is no-op for unknown id', () => {
      const mgr = createPluginManager(makeMockAPI());
      expect(() => mgr.unregister('unknown')).not.toThrow();
    });
  });

  describe('activate / deactivate', () => {
    it('calls onActivate with the plugin API', () => {
      const onActivate = vi.fn();
      const mgr = createPluginManager(makeMockAPI());
      mgr.register(makePlugin('p1', { onActivate }));
      mgr.activate('p1');
      expect(onActivate).toHaveBeenCalledOnce();
      expect(onActivate.mock.calls[0][0]).toBeDefined();
    });

    it('throws when activating unregistered plugin', () => {
      const mgr = createPluginManager(makeMockAPI());
      expect(() => mgr.activate('nope')).toThrow('not registered');
    });

    it('activation is idempotent', () => {
      const onActivate = vi.fn();
      const mgr = createPluginManager(makeMockAPI());
      mgr.register(makePlugin('p1', { onActivate }));
      mgr.activate('p1');
      mgr.activate('p1'); // second call
      expect(onActivate).toHaveBeenCalledOnce();
    });

    it('calls onDeactivate', () => {
      const onDeactivate = vi.fn();
      const mgr = createPluginManager(makeMockAPI());
      mgr.register(makePlugin('p1', { onDeactivate }));
      mgr.activate('p1');
      mgr.deactivate('p1');
      expect(onDeactivate).toHaveBeenCalledOnce();
    });

    it('deactivation is idempotent', () => {
      const onDeactivate = vi.fn();
      const mgr = createPluginManager(makeMockAPI());
      mgr.register(makePlugin('p1', { onDeactivate }));
      mgr.activate('p1');
      mgr.deactivate('p1');
      mgr.deactivate('p1');
      expect(onDeactivate).toHaveBeenCalledOnce();
    });

    it('handles async onActivate (fire-and-forget)', () => {
      const mgr = createPluginManager(makeMockAPI());
      mgr.register(makePlugin('p1', {
        onActivate: async () => {
          await Promise.resolve();
        },
      }));
      expect(() => mgr.activate('p1')).not.toThrow();
    });

    it('handles async onActivate rejection without crashing', () => {
      const mgr = createPluginManager(makeMockAPI());
      mgr.register(makePlugin('p1', {
        onActivate: async () => {
          throw new Error('boom');
        },
      }));
      expect(() => mgr.activate('p1')).not.toThrow();
    });
  });

  describe('emit', () => {
    it('emits onAnnotationCreated to active plugins', () => {
      const hook = vi.fn();
      const mgr = createPluginManager(makeMockAPI());
      mgr.register(makePlugin('p1', { onAnnotationCreated: hook }));
      mgr.activate('p1');

      mgr.emit('onAnnotationCreated', sampleAnnotation, 1);
      expect(hook).toHaveBeenCalledWith(sampleAnnotation, 1);
    });

    it('does not emit to inactive plugins', () => {
      const hook = vi.fn();
      const mgr = createPluginManager(makeMockAPI());
      mgr.register(makePlugin('p1', { onAnnotationCreated: hook }));
      // Not activated

      mgr.emit('onAnnotationCreated', sampleAnnotation, 1);
      expect(hook).not.toHaveBeenCalled();
    });

    it('emits to multiple active plugins', () => {
      const hook1 = vi.fn();
      const hook2 = vi.fn();
      const mgr = createPluginManager(makeMockAPI());
      mgr.register(makePlugin('p1', { onAnnotationCreated: hook1 }));
      mgr.register(makePlugin('p2', { onAnnotationCreated: hook2 }));
      mgr.activate('p1');
      mgr.activate('p2');

      mgr.emit('onAnnotationCreated', sampleAnnotation, 1);
      expect(hook1).toHaveBeenCalled();
      expect(hook2).toHaveBeenCalled();
    });

    it('continues emitting even if one plugin throws', () => {
      const hook2 = vi.fn();
      const mgr = createPluginManager(makeMockAPI());
      mgr.register(makePlugin('p1', {
        onAnnotationCreated: () => { throw new Error('plugin crash'); },
      }));
      mgr.register(makePlugin('p2', { onAnnotationCreated: hook2 }));
      mgr.activate('p1');
      mgr.activate('p2');

      mgr.emit('onAnnotationCreated', sampleAnnotation, 1);
      expect(hook2).toHaveBeenCalled();
    });

    it('emits onPageChange', () => {
      const hook = vi.fn();
      const mgr = createPluginManager(makeMockAPI());
      mgr.register(makePlugin('p1', { onPageChange: hook }));
      mgr.activate('p1');

      mgr.emit('onPageChange', 3);
      expect(hook).toHaveBeenCalledWith(3);
    });

    it('emits onDocumentLoad', () => {
      const hook = vi.fn();
      const mgr = createPluginManager(makeMockAPI());
      mgr.register(makePlugin('p1', { onDocumentLoad: hook }));
      mgr.activate('p1');

      mgr.emit('onDocumentLoad', 'fp123', 10);
      expect(hook).toHaveBeenCalledWith('fp123', 10);
    });

    it('emits onExport', () => {
      const hook = vi.fn();
      const mgr = createPluginManager(makeMockAPI());
      mgr.register(makePlugin('p1', { onExport: hook }));
      mgr.activate('p1');

      mgr.emit('onExport', 'pdf');
      expect(hook).toHaveBeenCalledWith('pdf');
    });

    it('emits onAnnotationUpdated', () => {
      const hook = vi.fn();
      const mgr = createPluginManager(makeMockAPI());
      mgr.register(makePlugin('p1', { onAnnotationUpdated: hook }));
      mgr.activate('p1');

      mgr.emit('onAnnotationUpdated', sampleAnnotation, 2);
      expect(hook).toHaveBeenCalledWith(sampleAnnotation, 2);
    });

    it('emits onAnnotationDeleted', () => {
      const hook = vi.fn();
      const mgr = createPluginManager(makeMockAPI());
      mgr.register(makePlugin('p1', { onAnnotationDeleted: hook }));
      mgr.activate('p1');

      mgr.emit('onAnnotationDeleted', 'a1', 1);
      expect(hook).toHaveBeenCalledWith('a1', 1);
    });
  });

  describe('API methods via onActivate', () => {
    it('provides registerExportFormat', () => {
      const apiMock = makeMockAPI();
      const mgr = createPluginManager(apiMock);

      const format: ExportFormatPlugin = {
        id: 'csv',
        label: 'CSV Export',
        extension: '.csv',
        export: async () => new Blob(['data']),
      };

      mgr.register(makePlugin('p1', {
        onActivate(api) {
          api.registerExportFormat(format);
        },
      }));
      mgr.activate('p1');

      expect(mgr.getExportFormats()).toHaveLength(1);
      expect(mgr.getExportFormats()[0].id).toBe('csv');
    });

    it('provides registerPanel', () => {
      const apiMock = makeMockAPI();
      const mgr = createPluginManager(apiMock);

      const panel: PanelPlugin = {
        id: 'my-panel',
        label: 'My Panel',
        render: vi.fn(),
      };

      mgr.register(makePlugin('p1', {
        onActivate(api) {
          api.registerPanel(panel);
        },
      }));
      mgr.activate('p1');

      expect(mgr.getPanels()).toHaveLength(1);
      expect(mgr.getPanels()[0].id).toBe('my-panel');
    });

    it('provides showNotification', () => {
      const showNotification = vi.fn();
      const mgr = createPluginManager(makeMockAPI({ showNotification }));

      mgr.register(makePlugin('p1', {
        onActivate(api) {
          api.showNotification('Hello!', 'info');
        },
      }));
      mgr.activate('p1');

      expect(showNotification).toHaveBeenCalledWith('Hello!', 'info');
    });

    it('provides getDocumentInfo', () => {
      const mgr = createPluginManager(makeMockAPI());
      let info: ReturnType<PluginAPI['getDocumentInfo']> | undefined;

      mgr.register(makePlugin('p1', {
        onActivate(api) {
          info = api.getDocumentInfo();
        },
      }));
      mgr.activate('p1');

      expect(info).toEqual({ fingerprint: 'abc', pageCount: 5, fileName: 'test.pdf' });
    });
  });
});
