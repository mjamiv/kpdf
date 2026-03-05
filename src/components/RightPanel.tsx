import type { RightTab } from '../hooks/usePanelState';
import type { Annotation, AnnotationsByPage } from '../types';
import type { CommentThread } from '../workflow/threading';
import type { PunchList, PunchItem } from '../workflow/punchList';
import type { AIManager, SmartLabel, GroupSuggestion } from '../ai/aiFeatures';
import CommentsPanel from './CommentsPanel';
import ThreadedComments from './ThreadedComments';
import MarkupsList from './MarkupsList';
import PunchListPanel from './PunchListPanel';
import AIAssistPanel from './AIAssistPanel';

type RightPanelProps = {
  open: boolean;
  tab: RightTab;
  onSetTab: (tab: RightTab) => void;
  onClose: () => void;
  // Comments
  annotationsByPage: AnnotationsByPage;
  onCommentJump: (page: number, annotationId: string) => void;
  // Threaded comments
  threads: CommentThread[];
  currentAuthor: string;
  onAddReply: (threadId: string, text: string, parentId?: string) => void;
  onResolveThread: (threadId: string) => void;
  onReopenThread: (threadId: string) => void;
  // Markups
  onUpdateAnnotation: (page: number, id: string, patch: Partial<Annotation>) => void;
  onDeleteAnnotations: (items: Array<{ page: number; id: string }>) => void;
  // Punch list
  punchList: PunchList;
  currentUser: string;
  onAddPunchItem: (item: Partial<PunchItem>) => void;
  onUpdatePunchItem: (id: string, patch: Partial<PunchItem>) => void;
  onRemovePunchItem: (id: string) => void;
  // AI
  annotations: Annotation[];
  aiManager: AIManager;
  onApplyLabels: (labels: SmartLabel[]) => void;
  onGroupAnnotations: (group: GroupSuggestion) => void;
};

const TAB_LABELS: Record<RightTab, string> = {
  comments: 'Comments',
  markups: 'Markups',
  punchList: 'Punch List',
  properties: 'Properties',
  ai: 'AI',
};

const TABS: RightTab[] = ['comments', 'markups', 'punchList', 'properties', 'ai'];

export default function RightPanel(props: RightPanelProps) {
  const { open, tab, onSetTab, onClose } = props;

  return (
    <aside className={`right-panel${open ? ' open' : ''}`} role="complementary" aria-label="Details panel">
      <div className="panel-tab-bar">
        {TABS.map((t) => (
          <button
            key={t}
            className={`panel-tab${tab === t ? ' active' : ''}`}
            onClick={() => onSetTab(t)}
            aria-label={`${TAB_LABELS[t]} tab`}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
        <button className="panel-close" onClick={onClose} aria-label="Close panel">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <line x1="1" y1="1" x2="11" y2="11" /><line x1="11" y1="1" x2="1" y2="11" />
          </svg>
        </button>
      </div>
      <div className="panel-body">
        {tab === 'comments' && (
          <div className="panel-section">
            <ThreadedComments
              threads={props.threads}
              currentAuthor={props.currentAuthor}
              onAddReply={props.onAddReply}
              onResolve={props.onResolveThread}
              onReopen={props.onReopenThread}
            />
            <div style={{ borderTop: '1px solid var(--line)', marginTop: 12, paddingTop: 12 }}>
              <CommentsPanel
                visible={true}
                annotationsByPage={props.annotationsByPage}
                onJumpTo={props.onCommentJump}
                onClose={() => {}}
              />
            </div>
          </div>
        )}
        {tab === 'markups' && (
          <MarkupsList
            visible={true}
            annotationsByPage={props.annotationsByPage}
            onJumpTo={props.onCommentJump}
            onClose={onClose}
            onUpdateAnnotation={props.onUpdateAnnotation}
            onDeleteAnnotations={props.onDeleteAnnotations}
          />
        )}
        {tab === 'punchList' && (
          <PunchListPanel
            punchList={props.punchList}
            currentUser={props.currentUser}
            onAddItem={props.onAddPunchItem}
            onUpdateItem={props.onUpdatePunchItem}
            onRemoveItem={props.onRemovePunchItem}
            onNavigateToAnnotation={(annotationId, page) => props.onCommentJump(page, annotationId)}
          />
        )}
        {tab === 'properties' && (
          <div className="panel-section" style={{ padding: 16, color: 'var(--muted)' }}>
            Select an annotation to view its properties.
          </div>
        )}
        {tab === 'ai' && (
          <AIAssistPanel
            annotations={props.annotations}
            aiManager={props.aiManager}
            onApplyLabels={props.onApplyLabels}
            onGroupAnnotations={props.onGroupAnnotations}
          />
        )}
      </div>
    </aside>
  );
}
