/**
 * Built-in example plugins — Phase 5.1
 *
 * Three demonstration plugins showing the Plugin API surface:
 *   1. wordCountPlugin   — counts words across text annotations, shows via notification
 *   2. annotationStatsPlugin — tracks annotation creation stats by type
 *   3. autoSavePlugin    — periodic save reminder notifications
 */

import type { Annotation } from '../types';
import type { Plugin, PluginAPI } from './pluginApi';

// ---------------------------------------------------------------------------
// 1. Word Count Plugin
// ---------------------------------------------------------------------------

function countWords(text: string): number {
  return text
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0).length;
}

function getTextContent(a: Annotation): string {
  if (a.type === 'text') return a.text;
  if (a.type === 'callout') return a.text;
  return '';
}

export function createWordCountPlugin(): Plugin {
  let api: PluginAPI | null = null;

  return {
    id: 'builtin.word-count',
    name: 'Word Count',
    version: '1.0.0',
    description: 'Counts total words across all text annotations on the current page.',
    author: 'KPDF',

    onActivate(pluginApi) {
      api = pluginApi;
    },

    onDeactivate() {
      api = null;
    },

    onAnnotationCreated() {
      if (!api) return;
      const annotations = api.getAnnotations(api.getCurrentPage());
      const total = annotations.reduce((sum, a) => sum + countWords(getTextContent(a)), 0);
      api.showNotification(`Word count (page ${api.getCurrentPage()}): ${total}`);
    },

    onAnnotationUpdated() {
      if (!api) return;
      const annotations = api.getAnnotations(api.getCurrentPage());
      const total = annotations.reduce((sum, a) => sum + countWords(getTextContent(a)), 0);
      api.showNotification(`Word count (page ${api.getCurrentPage()}): ${total}`);
    },
  };
}

// ---------------------------------------------------------------------------
// 2. Annotation Stats Plugin
// ---------------------------------------------------------------------------

export type AnnotationStats = {
  totalCreated: number;
  byType: Record<string, number>;
  byAuthor: Record<string, number>;
};

export function createAnnotationStatsPlugin(): Plugin & { getStats(): AnnotationStats } {
  const stats: AnnotationStats = {
    totalCreated: 0,
    byType: {},
    byAuthor: {},
  };

  return {
    id: 'builtin.annotation-stats',
    name: 'Annotation Stats',
    version: '1.0.0',
    description: 'Tracks annotation creation statistics by type and author.',
    author: 'KPDF',

    onActivate() {
      // Reset stats on activation
      stats.totalCreated = 0;
      stats.byType = {};
      stats.byAuthor = {};
    },

    onAnnotationCreated(annotation: Annotation) {
      stats.totalCreated += 1;
      stats.byType[annotation.type] = (stats.byType[annotation.type] ?? 0) + 1;
      stats.byAuthor[annotation.author] = (stats.byAuthor[annotation.author] ?? 0) + 1;
    },

    getStats() {
      return { ...stats, byType: { ...stats.byType }, byAuthor: { ...stats.byAuthor } };
    },
  };
}

// ---------------------------------------------------------------------------
// 3. Auto-Save Plugin
// ---------------------------------------------------------------------------

export function createAutoSavePlugin(intervalMs = 60_000): Plugin {
  let api: PluginAPI | null = null;
  let timer: ReturnType<typeof setInterval> | null = null;

  return {
    id: 'builtin.auto-save',
    name: 'Auto-Save Reminder',
    version: '1.0.0',
    description: 'Triggers periodic save reminder notifications.',
    author: 'KPDF',

    onActivate(pluginApi) {
      api = pluginApi;
      timer = setInterval(() => {
        if (api) {
          api.showNotification('Auto-save: remember to save your work!', 'info');
        }
      }, intervalMs);
    },

    onDeactivate() {
      if (timer !== null) {
        clearInterval(timer);
        timer = null;
      }
      api = null;
    },
  };
}
