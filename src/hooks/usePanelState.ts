import { useCallback, useState } from 'react';

export type LeftTab = 'sheets' | 'pages';
export type RightTab = 'activity' | 'markups' | 'ai';

export type Overlay = 'shortcuts' | 'scaleCalibration' | 'stampPicker' | 'toolPresets' | 'storageBrowser' | 'compare' | null;

export type PanelState = {
  leftOpen: boolean;
  leftTab: LeftTab;
  rightOpen: boolean;
  rightTab: RightTab;
  commandPaletteOpen: boolean;
  overlay: Overlay;
};

const initialState: PanelState = {
  leftOpen: false,
  leftTab: 'sheets',
  rightOpen: false,
  rightTab: 'activity',
  commandPaletteOpen: false,
  overlay: null,
};

export function usePanelState() {
  const [state, setState] = useState<PanelState>(initialState);

  const toggleLeft = useCallback(() => setState((s) => ({ ...s, leftOpen: !s.leftOpen })), []);
  const setLeftTab = useCallback((tab: LeftTab) => setState((s) => ({ ...s, leftTab: tab, leftOpen: true })), []);

  const toggleRight = useCallback(() => setState((s) => ({ ...s, rightOpen: !s.rightOpen })), []);
  const openRight = useCallback((tab: RightTab) => setState((s) => ({ ...s, rightTab: tab, rightOpen: true })), []);
  const setRightTab = useCallback((tab: RightTab) => setState((s) => ({ ...s, rightTab: tab, rightOpen: true })), []);

  const toggleCommandPalette = useCallback(() => setState((s) => ({ ...s, commandPaletteOpen: !s.commandPaletteOpen })), []);
  const closeCommandPalette = useCallback(() => setState((s) => ({ ...s, commandPaletteOpen: false })), []);

  const setOverlay = useCallback((overlay: Overlay) => setState((s) => ({ ...s, overlay })), []);
  const closeOverlay = useCallback(() => setState((s) => ({ ...s, overlay: null })), []);
  const toggleOverlay = useCallback((overlay: Overlay) => setState((s) => ({ ...s, overlay: s.overlay === overlay ? null : overlay })), []);

  // Backward-compatible convenience methods
  const toggleShortcuts = useCallback(() => toggleOverlay('shortcuts'), [toggleOverlay]);
  const closeShortcuts = useCallback(() => closeOverlay(), [closeOverlay]);
  const toggleScaleCalibration = useCallback(() => toggleOverlay('scaleCalibration'), [toggleOverlay]);
  const closeScaleCalibration = useCallback(() => closeOverlay(), [closeOverlay]);
  const toggleStampPicker = useCallback(() => toggleOverlay('stampPicker'), [toggleOverlay]);
  const closeStampPicker = useCallback(() => closeOverlay(), [closeOverlay]);
  const toggleToolPresets = useCallback(() => toggleOverlay('toolPresets'), [toggleOverlay]);
  const closeToolPresets = useCallback(() => closeOverlay(), [closeOverlay]);
  const toggleStorageBrowser = useCallback(() => toggleOverlay('storageBrowser'), [toggleOverlay]);
  const closeStorageBrowser = useCallback(() => closeOverlay(), [closeOverlay]);
  const toggleCompareMode = useCallback(() => toggleOverlay('compare'), [toggleOverlay]);

  return {
    panels: {
      ...state,
      // Backward-compat computed booleans
      showShortcuts: state.overlay === 'shortcuts',
      showScaleCalibration: state.overlay === 'scaleCalibration',
      showStampPicker: state.overlay === 'stampPicker',
      showToolPresets: state.overlay === 'toolPresets',
      storageBrowserOpen: state.overlay === 'storageBrowser',
      compareMode: state.overlay === 'compare',
    },
    toggleLeft,
    setLeftTab,
    toggleRight,
    openRight,
    setRightTab,
    toggleCommandPalette,
    closeCommandPalette,
    setOverlay,
    closeOverlay,
    toggleOverlay,
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
