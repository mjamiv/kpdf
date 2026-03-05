import type { Tool } from '../types';

type StatusBarProps = {
  status: string;
  tool?: Tool;
  lockedTool?: Tool | null;
};

export default function StatusBar({ status, tool, lockedTool }: StatusBarProps) {
  return (
    <footer className="status-line" role="status" aria-live="polite">
      <span>{status}</span>
      <span className="status-spacer" />
      {tool && tool !== 'select' && (
        <span className="status-tool">{tool}{lockedTool ? ' (locked)' : ''}</span>
      )}
      <span className="status-hint">Cmd+K</span>
    </footer>
  );
}
