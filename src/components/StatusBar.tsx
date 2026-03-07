import { memo } from 'react';
import type { Tool } from '../types';

type StatusBarProps = {
  status: string;
  tool?: Tool;
  lockedTool?: Tool | null;
};

function StatusBar({ status, tool, lockedTool }: StatusBarProps) {
  const isError = status.includes('error') || status.includes('Error');
  return (
    <footer className={`status-line${isError ? ' status-error' : ''}`} role="status" aria-live="polite">
      <span>{status}</span>
      <span className="status-spacer" />
      {tool && (
        <span className="status-tool">{tool}{lockedTool ? ' (locked)' : ''}</span>
      )}
      <span className="status-hint">Cmd+K</span>
    </footer>
  );
}

export default memo(StatusBar);
