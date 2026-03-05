import { TOOL_SHORTCUTS } from '../tools/shortcuts';

type ShortcutHelpPanelProps = {
  visible: boolean;
  onClose: () => void;
};

export default function ShortcutHelpPanel({ visible, onClose }: ShortcutHelpPanelProps) {
  if (!visible) return null;

  return (
    <div className="shortcut-panel-overlay" onClick={onClose} role="presentation">
      <div className="shortcut-panel" role="dialog" aria-modal="true" aria-labelledby="shortcut-panel-title" onClick={(e) => e.stopPropagation()}>
        <h3 id="shortcut-panel-title">Keyboard Shortcuts</h3>
        <table>
          <thead>
            <tr><th>Key</th><th>Tool</th></tr>
          </thead>
          <tbody>
            {TOOL_SHORTCUTS.map((s) => (
              <tr key={s.key}><td><kbd>{s.key.toUpperCase()}</kbd></td><td>{s.label}</td></tr>
            ))}
            <tr><td><kbd>Ctrl+O</kbd></td><td>Open PDF</td></tr>
            <tr><td><kbd>Ctrl+S</kbd></td><td>Save PDF</td></tr>
            <tr><td><kbd>Ctrl+W</kbd></td><td>Close tab</td></tr>
            <tr><td><kbd>Ctrl+Z</kbd></td><td>Undo</td></tr>
            <tr><td><kbd>Ctrl+Shift+Z</kbd></td><td>Redo</td></tr>
            <tr><td><kbd>Ctrl++</kbd></td><td>Zoom in</td></tr>
            <tr><td><kbd>Ctrl+-</kbd></td><td>Zoom out</td></tr>
            <tr><td><kbd>PgUp / ←</kbd></td><td>Previous page</td></tr>
            <tr><td><kbd>PgDn / →</kbd></td><td>Next page</td></tr>
            <tr><td><kbd>Delete</kbd></td><td>Delete selected</td></tr>
            <tr><td><kbd>[</kbd></td><td>Send backward</td></tr>
            <tr><td><kbd>]</kbd></td><td>Bring forward</td></tr>
            <tr><td><kbd>Esc</kbd></td><td>Cancel / close</td></tr>
            <tr><td><kbd>?</kbd></td><td>Toggle shortcuts</td></tr>
          </tbody>
        </table>
        <button onClick={onClose}>Dismiss</button>
      </div>
    </div>
  );
}
