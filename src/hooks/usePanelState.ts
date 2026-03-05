import { useCallback, useState } from 'react';

export type LeftTab = 'sheets' | 'pages';
export type RightTab = 'comments' | 'markups' | 'punchList' | 'properties' | 'ai';

export type PanelState = {
  leftOpen: boolean;
  leftTab: LeftTab;
  rightOpen: boolean;
  rightTab: RightTab;
  commandPaletteOpen: boolean;
  storageBrowserOpen: boolean;
  compareMode: boolean;
  showShortcuts: boolean;
  showScaleCalibration: boolean;
  showStampPicker: boolean;
  showToolPresets: boolean;
};

const initialState: PanelState = {
  leftOpen: false,
  leftTab: 'sheets',
  rightOpen: false,
  rightTab: 'comments',
  commandPaletteOpen: false,
  storageBrowserOpen: false,
  compareMode: false,
  showShortcuts: false,
  showScaleCalibration: false,
  showStampPicker: false,
  showToolPresets: false,
};

export function usePanelState() {
  const [state, setState] = useState<PanelState>(initialState);

  const toggleLeft = useCallback(() => setState((s) => ({ ...s, leftOpen: !s.leftOpen })), []);
  const setLeftTab = useCallback((tab: LeftTab) => setState((s) => ({ ...s, leftTab: tab, leftOpen: true })), []);

  const toggleRight = useCallback(() => setState((s) => ({ ...s, rightOpen: !s.rightOpen })), []);
  const setRightTab = useCallback((tab: RightTab) => setState((s) => ({ ...s, rightTab: tab, rightOpen: true })), []);

  const toggleCommandPalette = useCallback(() => setState((s) => ({ ...s, commandPaletteOpen: !s.commandPaletteOpen })), []);
  const closeCommandPalette = useCallback(() => setState((s) => ({ ...s, commandPaletteOpen: false })), []);

  const toggleStorageBrowser = useCallback(() => setState((s) => ({ ...s, storageBrowserOpen: !s.storageBrowserOpen })), []);
  const closeStorageBrowser = useCallback(() => setState((s) => ({ ...s, storageBrowserOpen: false })), []);

  const toggleCompareMode = useCallback(() => setState((s) => ({ ...s, compareMode: !s.compareMode })), []);

  const toggleShortcuts = useCallback(() => setState((s) => ({ ...s, showShortcuts: !s.showShortcuts })), []);
  const closeShortcuts = useCallback(() => setState((s) => ({ ...s, showShortcuts: false })), []);

  const toggleScaleCalibration = useCallback(() => setState((s) => ({ ...s, showScaleCalibration: !s.showScaleCalibration })), []);
  const closeScaleCalibration = useCallback(() => setState((s) => ({ ...s, showScaleCalibration: false })), []);

  const toggleStampPicker = useCallback(() => setState((s) => ({ ...s, showStampPicker: !s.showStampPicker })), []);
  const closeStampPicker = useCallback(() => setState((s) => ({ ...s, showStampPicker: false })), []);

  const toggleToolPresets = useCallback(() => setState((s) => ({ ...s, showToolPresets: !s.showToolPresets })), []);
  const closeToolPresets = useCallback(() => setState((s) => ({ ...s, showToolPresets: false })), []);

  return {
    panels: state,
    toggleLeft,
    setLeftTab,
    toggleRight,
    setRightTab,
    toggleCommandPalette,
    closeCommandPalette,
    toggleStorageBrowser,
    closeStorageBrowser,
    toggleCompareMode,
    toggleShortcuts,
    closeShortcuts,
    toggleScaleCalibration,
    closeScaleCalibration,
    toggleStampPicker,
    closeStampPicker,
    toggleToolPresets,
    closeToolPresets,
  };
}
