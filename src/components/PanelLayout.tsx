import type { ReactNode } from 'react';

type PanelLayoutProps = {
  toolRail: ReactNode;
  leftSidebar: ReactNode;
  rightPanel: ReactNode;
  children: ReactNode;
};

export default function PanelLayout({ toolRail, leftSidebar, rightPanel, children }: PanelLayoutProps) {
  return (
    <div className="panel-layout">
      {toolRail}
      {leftSidebar}
      {children}
      {rightPanel}
    </div>
  );
}
