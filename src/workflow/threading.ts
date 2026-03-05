import { randomId } from '../engine/utils';

export type ThreadComment = {
  id: string;
  threadId: string;
  annotationId: string;
  author: string;
  text: string;
  createdAt: string;
  updatedAt: string;
  parentId?: string;
  mentions: string[];
  resolved: boolean;
};

export type CommentThread = {
  id: string;
  annotationId: string;
  comments: ThreadComment[];
  resolved: boolean;
  createdAt: string;
};

/**
 * Extract @username mentions from text.
 * Matches @word where word is alphanumeric, underscore, hyphen, or dot.
 */
export function extractMentions(text: string): string[] {
  const matches = text.match(/@[\w.-]+/g);
  if (!matches) return [];
  // Strip the @ prefix and deduplicate
  return [...new Set(matches.map((m) => m.slice(1)))];
}

/**
 * Create a new comment thread on an annotation.
 */
export function createThread(annotationId: string, author: string, text: string): CommentThread {
  const now = new Date().toISOString();
  const threadId = randomId();
  const comment: ThreadComment = {
    id: randomId(),
    threadId,
    annotationId,
    author,
    text,
    createdAt: now,
    updatedAt: now,
    mentions: extractMentions(text),
    resolved: false,
  };
  return {
    id: threadId,
    annotationId,
    comments: [comment],
    resolved: false,
    createdAt: now,
  };
}

/**
 * Add a reply to a thread. Optionally specify parentId for nested replies.
 */
export function addReply(
  thread: CommentThread,
  author: string,
  text: string,
  parentId?: string,
): CommentThread {
  const now = new Date().toISOString();
  const reply: ThreadComment = {
    id: randomId(),
    threadId: thread.id,
    annotationId: thread.annotationId,
    author,
    text,
    createdAt: now,
    updatedAt: now,
    parentId,
    mentions: extractMentions(text),
    resolved: false,
  };
  return {
    ...thread,
    comments: [...thread.comments, reply],
  };
}

/**
 * Mark a thread as resolved.
 */
export function resolveThread(thread: CommentThread): CommentThread {
  return {
    ...thread,
    resolved: true,
    comments: thread.comments.map((c) => ({ ...c, resolved: true })),
  };
}

/**
 * Reopen a resolved thread.
 */
export function reopenThread(thread: CommentThread): CommentThread {
  return {
    ...thread,
    resolved: false,
    comments: thread.comments.map((c) => ({ ...c, resolved: false })),
  };
}

/**
 * Get aggregate statistics for a list of threads.
 */
export function getThreadStats(threads: CommentThread[]): {
  total: number;
  resolved: number;
  unresolved: number;
  byAuthor: Record<string, number>;
} {
  const byAuthor: Record<string, number> = {};
  let resolved = 0;
  let unresolved = 0;

  for (const thread of threads) {
    if (thread.resolved) {
      resolved++;
    } else {
      unresolved++;
    }
    for (const comment of thread.comments) {
      byAuthor[comment.author] = (byAuthor[comment.author] ?? 0) + 1;
    }
  }

  return { total: threads.length, resolved, unresolved, byAuthor };
}
