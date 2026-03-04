import { useMemo, useState } from 'react';
import type { AnnotationsByPage } from '../types';
import { extractComments, filterComments, getCommentAuthors, type CommentFilter } from '../workflow/comments';

type CommentsPanelProps = {
  visible: boolean;
  annotationsByPage: AnnotationsByPage;
  onJumpTo: (page: number, annotationId: string) => void;
  onClose: () => void;
};

export default function CommentsPanel({ visible, annotationsByPage, onJumpTo, onClose }: CommentsPanelProps) {
  const [filterAuthor, setFilterAuthor] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');

  const allComments = useMemo(() => extractComments(annotationsByPage), [annotationsByPage]);
  const authors = useMemo(() => getCommentAuthors(allComments), [allComments]);

  const filtered = useMemo(() => {
    const f: CommentFilter = {};
    if (filterAuthor) f.author = filterAuthor;
    if (filterStatus) f.status = filterStatus as 'open' | 'resolved' | 'rejected';
    return filterComments(allComments, f);
  }, [allComments, filterAuthor, filterStatus]);

  if (!visible) return null;

  return (
    <div className="comments-panel">
      <div className="comments-header">
        <h3>Comments ({filtered.length})</h3>
        <button onClick={onClose}>x</button>
      </div>
      <div className="comments-filters">
        <select value={filterAuthor} onChange={(e) => setFilterAuthor(e.target.value)}>
          <option value="">All authors</option>
          {authors.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          <option value="">All statuses</option>
          <option value="open">Open</option>
          <option value="resolved">Resolved</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>
      <div className="comments-list">
        {filtered.length === 0 && <p className="comments-empty">No comments found.</p>}
        {filtered.map((entry) => (
          <div
            key={entry.annotation.id}
            className="comment-item"
            onClick={() => onJumpTo(entry.page, entry.annotation.id)}
          >
            <div className="comment-meta">
              <span className="comment-page">p.{entry.page}</span>
              <span className="comment-type">{entry.annotation.type}</span>
              <span className="comment-author">{entry.annotation.author}</span>
              {entry.annotation.status && (
                <span className={`comment-status comment-status-${entry.annotation.status}`}>
                  {entry.annotation.status}
                </span>
              )}
            </div>
            <div className="comment-text">{entry.annotation.comment}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
