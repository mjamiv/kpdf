import type { DocumentTab } from '../workflow/documentStore';

type TabBarProps = {
  tabs: DocumentTab[];
  activeTabId: string;
  onSelectTab: (id: string) => void;
  onCloseTab: (id: string) => void;
};

export default function TabBar({ tabs, activeTabId, onSelectTab, onCloseTab }: TabBarProps) {
  if (tabs.length === 0) return null;

  return (
    <div className="tab-bar" role="tablist" aria-label="Open documents">
      {tabs.map((tab) => (
        <div
          key={tab.id}
          className={`tab ${tab.id === activeTabId ? 'tab-active' : ''}`}
          role="tab"
          aria-selected={tab.id === activeTabId}
          tabIndex={tab.id === activeTabId ? 0 : -1}
          onClick={() => onSelectTab(tab.id)}
        >
          <span className="tab-name">
            {tab.dirty && <span className="tab-dirty">*</span>}
            {tab.fileName}
          </span>
          <button
            className="tab-close"
            onClick={(e) => {
              e.stopPropagation();
              if (tab.dirty && !window.confirm(`"${tab.fileName}" has unsaved changes. Close anyway?`)) return;
              onCloseTab(tab.id);
            }}
            aria-label="Close tab"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><line x1="1" y1="1" x2="9" y2="9"/><line x1="9" y1="1" x2="1" y2="9"/></svg>
          </button>
        </div>
      ))}
    </div>
  );
}
