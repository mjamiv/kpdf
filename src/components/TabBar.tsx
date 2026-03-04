import type { DocumentTab } from '../workflow/documentStore';

type TabBarProps = {
  tabs: DocumentTab[];
  activeTabId: string;
  onSelectTab: (id: string) => void;
  onCloseTab: (id: string) => void;
};

export default function TabBar({ tabs, activeTabId, onSelectTab, onCloseTab }: TabBarProps) {
  if (tabs.length <= 1) return null;

  return (
    <div className="tab-bar">
      {tabs.map((tab) => (
        <div
          key={tab.id}
          className={`tab ${tab.id === activeTabId ? 'tab-active' : ''}`}
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
          >
            x
          </button>
        </div>
      ))}
    </div>
  );
}
