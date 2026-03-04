import { TOOL_SHORTCUTS } from '../tools/shortcuts';

type ShortcutHelpPanelProps = {
  visible: boolean;
  onClose: () => void;
};

export default function ShortcutHelpPanel({ visible, onClose }: ShortcutHelpPanelProps) {
  if (!visible) return null;

  return (
    <div className="shortcut-panel-overlay" onClick={onClose}>
      <div className="shortcut-panel" onClick={(e) => e.stopPropagation()}>
        <h3>Keyboard Shortcuts</h3>
        <table>
          <thead>
            <tr><th>Key</th><th>Tool</th></tr>
          </thead>
          <tbody>
            {TOOL_SHORTCUTS.map((s) => (
              <tr key={s.key}><td><kbd>{s.key.toUpperCase()}</kbd></td><td>{s.label}</td></tr>
            ))}
            <tr><td><kbd>Ctrl+Z</kbd></td><td>Undo</td></tr>
            <tr><td><kbd>Ctrl+Shift+Z</kbd></td><td>Redo</td></tr>
            <tr><td><kbd>Delete</kbd></td><td>Delete selected</td></tr>
            <tr><td><kbd>[</kbd></td><td>Send backward</td></tr>
            <tr><td><kbd>]</kbd></td><td>Bring forward</td></tr>
            <tr><td><kbd>?</kbd></td><td>Toggle shortcuts</td></tr>
          </tbody>
        </table>
        <button onClick={onClose}>Close</button>
      </div>
    </div>
  );
}
