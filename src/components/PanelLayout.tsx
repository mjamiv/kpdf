import type { ReactNode } from 'react';

type PanelLayoutProps = {
  leftSidebar: ReactNode;
  rightPanel: ReactNode;
  children: ReactNode;
};

export default function PanelLayout({ leftSidebar, rightPanel, children }: PanelLayoutProps) {
  return (
    <div className="panel-layout">
      {leftSidebar}
      {children}
      {rightPanel}
    </div>
  );
}
