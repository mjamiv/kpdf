import { useState } from 'react';
import { createPluginManager, type PluginManager, type PluginAPI } from '../plugins/pluginApi';
import { createWordCountPlugin, createAnnotationStatsPlugin, createAutoSavePlugin } from '../plugins/builtinPlugins';
import { createStorageManager, type StorageManager } from '../storage/storageProvider';
import { createLocalStorageProvider } from '../storage/localStorageProvider';
import { createAIManager, createLocalAIProvider, type AIManager } from '../ai/aiFeatures';

export type Managers = {
  pluginManager: PluginManager;
  storageManager: StorageManager;
  aiManager: AIManager;
};

function initManagers(): Managers {
  // Storage
  const storageManager = createStorageManager();
  storageManager.registerProvider(createLocalStorageProvider());
  storageManager.setDefault('local');

  // AI
  const aiManager = createAIManager();
  aiManager.registerProvider(createLocalAIProvider());
  aiManager.setDefault('local-heuristic');

  // Plugins - create a stub PluginAPI (real hooks wired by App)
  const pluginAPI: PluginAPI = {
    getAnnotations: () => [],
    addAnnotation: () => {},
    removeAnnotation: () => {},
    getCurrentPage: () => 1,
    navigateToPage: () => {},
    registerTool: () => {},
    registerExportFormat: () => {},
    registerPanel: () => {},
    showNotification: () => {},
    getDocumentInfo: () => ({ fingerprint: '', pageCount: 0, fileName: '' }),
  };
  const pluginManager = createPluginManager(pluginAPI);
  pluginManager.register(createWordCountPlugin());
  pluginManager.register(createAnnotationStatsPlugin());
  pluginManager.register(createAutoSavePlugin());
  pluginManager.activate('builtin.word-count');
  pluginManager.activate('builtin.annotation-stats');
  pluginManager.activate('builtin.auto-save');

  return { pluginManager, storageManager, aiManager };
}

export function useManagerInit(): Managers {
  const [managers] = useState(initManagers);
  return managers;
}
