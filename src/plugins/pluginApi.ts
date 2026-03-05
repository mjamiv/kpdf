/**
 * KPDF Plugin API — Phase 5.1
 *
 * Core plugin system that allows third-party and built-in plugins to extend
 * KPDF functionality. Plugins register hooks for annotation lifecycle events,
 * page navigation, document loading, and export. They can also register custom
 * tools, export formats, and side panels via the PluginAPI surface.
 *
 * Integration with App.tsx:
 *   const pluginManager = createPluginManager(pluginAPI);
 *   pluginManager.register(myPlugin);
 *   pluginManager.activate('my-plugin');
 *   // On annotation create: pluginManager.emit('onAnnotationCreated', annotation, page);
 *   // On page change: pluginManager.emit('onPageChange', page);
 *   // etc.
 */

import type { Annotation, AnnotationsByPage } from '../types';
import type { ToolBehavior } from '../tools/registry';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PluginManifest = {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
};

export type PluginHooks = {
  onActivate?: (api: PluginAPI) => void | Promise<void>;
  onDeactivate?: () => void;
  onAnnotationCreated?: (annotation: Annotation, page: number) => void;
  onAnnotationUpdated?: (annotation: Annotation, page: number) => void;
  onAnnotationDeleted?: (annotationId: string, page: number) => void;
  onPageChange?: (page: number) => void;
  onDocumentLoad?: (fingerprint: string, pageCount: number) => void;
  onExport?: (format: string) => void;
};

export type Plugin = PluginManifest & PluginHooks;

export type ExportFormatPlugin = {
  id: string;
  label: string;
  extension: string;
  export: (annotationsByPage: AnnotationsByPage) => Promise<Blob>;
};

export type PanelPlugin = {
  id: string;
  label: string;
  icon?: string;
  render: (container: HTMLElement, api: PluginAPI) => void | (() => void);
};

export type PluginAPI = {
  getAnnotations(page: number): Annotation[];
  addAnnotation(page: number, annotation: Annotation): void;
  removeAnnotation(page: number, annotationId: string): void;
  getCurrentPage(): number;
  navigateToPage(page: number): void;
  registerTool(tool: ToolBehavior): void;
  registerExportFormat(format: ExportFormatPlugin): void;
  registerPanel(panel: PanelPlugin): void;
  showNotification(message: string, type?: 'info' | 'warning' | 'error'): void;
  getDocumentInfo(): { fingerprint: string; pageCount: number; fileName: string };
};

// ---------------------------------------------------------------------------
// Hook event names (used for type-safe emit)
// ---------------------------------------------------------------------------

type HookEventMap = {
  onAnnotationCreated: [annotation: Annotation, page: number];
  onAnnotationUpdated: [annotation: Annotation, page: number];
  onAnnotationDeleted: [annotationId: string, page: number];
  onPageChange: [page: number];
  onDocumentLoad: [fingerprint: string, pageCount: number];
  onExport: [format: string];
};

export type HookEvent = keyof HookEventMap;

// ---------------------------------------------------------------------------
// Internal entry tracking active plugins
// ---------------------------------------------------------------------------

type PluginEntry = {
  plugin: Plugin;
  active: boolean;
};

// ---------------------------------------------------------------------------
// PluginManager
// ---------------------------------------------------------------------------

export type PluginManager = {
  register(plugin: Plugin): void;
  unregister(pluginId: string): void;
  activate(pluginId: string): void;
  deactivate(pluginId: string): void;
  getPlugin(id: string): Plugin | undefined;
  listPlugins(): Plugin[];
  emit<E extends HookEvent>(event: E, ...args: HookEventMap[E]): void;
  /** Exposed for testing — returns registered export formats */
  getExportFormats(): ExportFormatPlugin[];
  /** Exposed for testing — returns registered panels */
  getPanels(): PanelPlugin[];
};

export function createPluginManager(api: PluginAPI): PluginManager {
  const entries = new Map<string, PluginEntry>();
  const exportFormats: ExportFormatPlugin[] = [];
  const panels: PanelPlugin[] = [];

  // Wrap the provided API so registerExportFormat / registerPanel accumulate
  // into the manager-scoped collections.
  function buildPluginAPI(): PluginAPI {
    return {
      ...api,
      registerExportFormat(format: ExportFormatPlugin) {
        exportFormats.push(format);
        api.registerExportFormat(format);
      },
      registerPanel(panel: PanelPlugin) {
        panels.push(panel);
        api.registerPanel(panel);
      },
    };
  }

  const pluginAPI = buildPluginAPI();

  return {
    register(plugin: Plugin) {
      if (entries.has(plugin.id)) {
        throw new Error(`Plugin "${plugin.id}" is already registered.`);
      }
      entries.set(plugin.id, { plugin, active: false });
    },

    unregister(pluginId: string) {
      const entry = entries.get(pluginId);
      if (!entry) return;
      if (entry.active && entry.plugin.onDeactivate) {
        entry.plugin.onDeactivate();
      }
      entries.delete(pluginId);
    },

    activate(pluginId: string) {
      const entry = entries.get(pluginId);
      if (!entry) throw new Error(`Plugin "${pluginId}" is not registered.`);
      if (entry.active) return;

      entry.active = true;
      if (entry.plugin.onActivate) {
        // Fire-and-forget for async hooks
        const result = entry.plugin.onActivate(pluginAPI);
        if (result && typeof (result as Promise<void>).catch === 'function') {
          (result as Promise<void>).catch(() => {
            /* fire-and-forget */
          });
        }
      }
    },

    deactivate(pluginId: string) {
      const entry = entries.get(pluginId);
      if (!entry) return;
      if (!entry.active) return;

      entry.active = false;
      if (entry.plugin.onDeactivate) {
        entry.plugin.onDeactivate();
      }
    },

    getPlugin(id: string) {
      return entries.get(id)?.plugin;
    },

    listPlugins() {
      return Array.from(entries.values()).map((e) => e.plugin);
    },

    emit<E extends HookEvent>(event: E, ...args: HookEventMap[E]) {
      for (const entry of entries.values()) {
        if (!entry.active) continue;
        const hook = entry.plugin[event] as ((...a: HookEventMap[E]) => void) | undefined;
        if (hook) {
          try {
            hook(...args);
          } catch {
            // Plugin errors must not crash the host
          }
        }
      }
    },

    getExportFormats() {
      return exportFormats;
    },

    getPanels() {
      return panels;
    },
  };
}
