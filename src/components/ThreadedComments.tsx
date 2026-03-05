/**
 * ThreadedComments — Threaded comment display for annotations.
 *
 * Integration with App.tsx:
 *   - Maintain a `threads: CommentThread[]` state in App (or via a useReducer slice).
 *   - Use `createThread`, `addReply`, `resolveThread`, `reopenThread` from
 *     `../workflow/threading` to manage thread state.
 *   - Pass threads, currentAuthor, and callbacks as props.
 *
 * Props:
 *   threads        — Array of CommentThread objects for the current document.
 *   currentAuthor  — The logged-in user's name (used for reply attribution).
 *   onAddReply     — Callback to add a reply to a thread (threadId, text, parentId?).
 *   onResolve      — Callback to mark a thread as resolved (threadId).
 *   onReopen       — Callback to reopen a resolved thread (threadId).
 */

import { useState, useMemo, useCallback } from 'react';
import type { CommentThread, ThreadComment } from '../workflow/threading';

type ThreadedCommentsProps = {
  threads: CommentThread[];
  currentAuthor: string;
  onAddReply: (threadId: string, text: string, parentId?: string) => void;
  onResolve: (threadId: string) => void;
  onReopen: (threadId: string) => void;
};

/** Highlight @mentions in text by wrapping them in <strong> */
function renderTextWithMentions(text: string): React.ReactNode[] {
  const parts = text.split(/(@[\w.-]+)/g);
  return parts.map((part, i) =>
    part.startsWith('@')
      ? <strong key={i} className="mention">{part}</strong>
      : <span key={i}>{part}</span>,
  );
}

/** Recursively build a tree of comments from the flat list. */
function buildCommentTree(comments: ThreadComment[]): Map<string | undefined, ThreadComment[]> {
  const tree = new Map<string | undefined, ThreadComment[]>();
  for (const c of comments) {
    const parent = c.parentId ?? undefined;
    const children = tree.get(parent) ?? [];
    children.push(c);
    tree.set(parent, children);
  }
  return tree;
}

function CommentNode({
  comment,
  tree,
  depth,
  onReply,
}: {
  comment: ThreadComment;
  tree: Map<string | undefined, ThreadComment[]>;
  depth: number;
  onReply: (parentId: string) => void;
}) {
  const children = tree.get(comment.id) ?? [];

  return (
    <div className="thread-comment" style={{ marginLeft: depth * 20 }}>
      <div className="thread-comment-header">
        <span className="thread-comment-author">{comment.author}</span>
        <span className="thread-comment-date">
          {new Date(comment.createdAt).toLocaleString()}
        </span>
      </div>
      <div className="thread-comment-text">
        {renderTextWithMentions(comment.text)}
      </div>
      <button
        className="thread-reply-btn"
        onClick={() => onReply(comment.id)}
      >
        Reply
      </button>
      {children.map((child) => (
        <CommentNode
          key={child.id}
          comment={child}
          tree={tree}
          depth={depth + 1}
          onReply={onReply}
        />
      ))}
    </div>
  );
}

function ThreadView({
  thread,
  currentAuthor,
  onAddReply,
  onResolve,
  onReopen,
}: {
  thread: CommentThread;
  currentAuthor: string;
  onAddReply: (threadId: string, text: string, parentId?: string) => void;
  onResolve: (threadId: string) => void;
  onReopen: (threadId: string) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [replyParentId, setReplyParentId] = useState<string | undefined>(undefined);

  const tree = useMemo(() => buildCommentTree(thread.comments), [thread.comments]);
  const rootComments = tree.get(undefined) ?? [];

  const handleReply = useCallback((parentId: string) => {
    setReplyParentId(parentId);
  }, []);

  const handleSubmitReply = useCallback(() => {
    const text = replyText.trim();
    if (!text) return;
    onAddReply(thread.id, text, replyParentId);
    setReplyText('');
    setReplyParentId(undefined);
  }, [replyText, replyParentId, thread.id, onAddReply]);

  return (
    <div className={`thread ${thread.resolved ? 'thread-resolved' : ''}`} data-testid={`thread-${thread.id}`}>
      <div className="thread-header">
        <button
          className="thread-collapse-btn"
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? 'Expand thread' : 'Collapse thread'}
        >
          {collapsed ? '+' : '-'}
        </button>
        <span className="thread-count">{thread.comments.length} comment{thread.comments.length !== 1 ? 's' : ''}</span>
        {thread.resolved ? (
          <button className="thread-reopen-btn" onClick={() => onReopen(thread.id)}>
            Reopen
          </button>
        ) : (
          <button className="thread-resolve-btn" onClick={() => onResolve(thread.id)}>
            Resolve
          </button>
        )}
      </div>

      {!collapsed && (
        <div className="thread-body">
          {rootComments.map((comment) => (
            <CommentNode
              key={comment.id}
              comment={comment}
              tree={tree}
              depth={0}
              onReply={handleReply}
            />
          ))}

          <div className="thread-reply-form">
            {replyParentId && (
              <div className="thread-reply-to">
                Replying to a comment{' '}
                <button onClick={() => setReplyParentId(undefined)}>Cancel</button>
              </div>
            )}
            <input
              type="text"
              className="thread-reply-input"
              placeholder={`Reply as ${currentAuthor}...`}
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSubmitReply();
              }}
            />
            <button
              className="thread-submit-btn"
              onClick={handleSubmitReply}
              disabled={!replyText.trim()}
            >
              Send
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ThreadedComments({
  threads,
  currentAuthor,
  onAddReply,
  onResolve,
  onReopen,
}: ThreadedCommentsProps) {
  if (threads.length === 0) {
    return <div className="threaded-comments-empty">No comment threads.</div>;
  }

  return (
    <div className="threaded-comments">
      {threads.map((thread) => (
        <ThreadView
          key={thread.id}
          thread={thread}
          currentAuthor={currentAuthor}
          onAddReply={onAddReply}
          onResolve={onResolve}
          onReopen={onReopen}
        />
      ))}
    </div>
  );
}
