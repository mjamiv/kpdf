import { memo, type ReactNode } from 'react';

type PanelLayoutProps = {
  toolRail: ReactNode;
  leftSidebar: ReactNode;
  rightPanel: ReactNode;
  children: ReactNode;
};

function PanelLayout({ toolRail, leftSidebar, rightPanel, children }: PanelLayoutProps) {
  return (
    <div className="panel-layout">
      {toolRail}
      {leftSidebar}
      {children}
      {rightPanel}
    </div>
  );
}

export default memo(PanelLayout);
