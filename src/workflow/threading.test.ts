import { describe, it, expect } from 'vitest';
import {
  createThread,
  addReply,
  resolveThread,
  reopenThread,
  extractMentions,
  getThreadStats,
  type CommentThread,
} from './threading';

describe('extractMentions', () => {
  it('extracts single mention', () => {
    expect(extractMentions('Hello @alice')).toEqual(['alice']);
  });

  it('extracts multiple mentions', () => {
    expect(extractMentions('@alice please review with @bob')).toEqual(['alice', 'bob']);
  });

  it('deduplicates mentions', () => {
    expect(extractMentions('@alice @alice @alice')).toEqual(['alice']);
  });

  it('returns empty for no mentions', () => {
    expect(extractMentions('No mentions here')).toEqual([]);
  });

  it('handles mentions with dots, hyphens, underscores', () => {
    expect(extractMentions('@john.doe @jane-smith @bob_jones')).toEqual([
      'john.doe', 'jane-smith', 'bob_jones',
    ]);
  });

  it('handles email-like patterns (extracts the username part)', () => {
    // @user in "user@domain" won't match since @ is not preceded by space/start
    // but @domain would match
    expect(extractMentions('email user@domain.com')).toEqual(['domain.com']);
  });
});

describe('createThread', () => {
  it('creates a thread with one comment', () => {
    const thread = createThread('ann-1', 'alice', 'First comment');
    expect(thread.annotationId).toBe('ann-1');
    expect(thread.resolved).toBe(false);
    expect(thread.comments).toHaveLength(1);
    expect(thread.comments[0].author).toBe('alice');
    expect(thread.comments[0].text).toBe('First comment');
    expect(thread.comments[0].threadId).toBe(thread.id);
    expect(thread.comments[0].annotationId).toBe('ann-1');
    expect(thread.comments[0].resolved).toBe(false);
    expect(thread.comments[0].mentions).toEqual([]);
  });

  it('extracts mentions from initial comment', () => {
    const thread = createThread('ann-1', 'alice', 'Hey @bob check this');
    expect(thread.comments[0].mentions).toEqual(['bob']);
  });

  it('generates unique IDs', () => {
    const t1 = createThread('a', 'alice', 'x');
    const t2 = createThread('a', 'alice', 'x');
    expect(t1.id).not.toBe(t2.id);
    expect(t1.comments[0].id).not.toBe(t2.comments[0].id);
  });
});

describe('addReply', () => {
  it('adds a reply to the thread', () => {
    const thread = createThread('ann-1', 'alice', 'Hello');
    const updated = addReply(thread, 'bob', 'Hi back');
    expect(updated.comments).toHaveLength(2);
    expect(updated.comments[1].author).toBe('bob');
    expect(updated.comments[1].text).toBe('Hi back');
    expect(updated.comments[1].threadId).toBe(thread.id);
    expect(updated.comments[1].parentId).toBeUndefined();
  });

  it('adds a nested reply with parentId', () => {
    const thread = createThread('ann-1', 'alice', 'Hello');
    const firstCommentId = thread.comments[0].id;
    const updated = addReply(thread, 'bob', 'Reply to first', firstCommentId);
    expect(updated.comments[1].parentId).toBe(firstCommentId);
  });

  it('extracts mentions from replies', () => {
    const thread = createThread('ann-1', 'alice', 'Hello');
    const updated = addReply(thread, 'bob', '@alice got it @carol');
    expect(updated.comments[1].mentions).toEqual(['alice', 'carol']);
  });

  it('does not mutate original thread', () => {
    const thread = createThread('ann-1', 'alice', 'Hello');
    const updated = addReply(thread, 'bob', 'Hi');
    expect(thread.comments).toHaveLength(1);
    expect(updated.comments).toHaveLength(2);
  });
});

describe('resolveThread', () => {
  it('marks thread and all comments as resolved', () => {
    let thread = createThread('ann-1', 'alice', 'Issue found');
    thread = addReply(thread, 'bob', 'Fixed');
    const resolved = resolveThread(thread);
    expect(resolved.resolved).toBe(true);
    expect(resolved.comments.every((c) => c.resolved)).toBe(true);
  });

  it('does not mutate original thread', () => {
    const thread = createThread('ann-1', 'alice', 'Issue');
    const resolved = resolveThread(thread);
    expect(thread.resolved).toBe(false);
    expect(resolved.resolved).toBe(true);
  });
});

describe('reopenThread', () => {
  it('marks thread and all comments as unresolved', () => {
    const thread = resolveThread(createThread('ann-1', 'alice', 'Issue'));
    expect(thread.resolved).toBe(true);
    const reopened = reopenThread(thread);
    expect(reopened.resolved).toBe(false);
    expect(reopened.comments.every((c) => !c.resolved)).toBe(true);
  });
});

describe('getThreadStats', () => {
  it('returns correct stats for empty array', () => {
    const stats = getThreadStats([]);
    expect(stats).toEqual({ total: 0, resolved: 0, unresolved: 0, byAuthor: {} });
  });

  it('counts resolved and unresolved threads', () => {
    const threads: CommentThread[] = [
      createThread('a1', 'alice', 'Open thread'),
      resolveThread(createThread('a2', 'bob', 'Resolved thread')),
      createThread('a3', 'alice', 'Another open'),
    ];
    const stats = getThreadStats(threads);
    expect(stats.total).toBe(3);
    expect(stats.resolved).toBe(1);
    expect(stats.unresolved).toBe(2);
  });

  it('counts comments by author', () => {
    let thread = createThread('a1', 'alice', 'Hello');
    thread = addReply(thread, 'bob', 'Hi');
    thread = addReply(thread, 'alice', 'Thanks');
    const stats = getThreadStats([thread]);
    expect(stats.byAuthor).toEqual({ alice: 2, bob: 1 });
  });

  it('aggregates across multiple threads', () => {
    const t1 = addReply(createThread('a1', 'alice', 'One'), 'bob', 'Two');
    const t2 = createThread('a2', 'carol', 'Three');
    const stats = getThreadStats([t1, t2]);
    expect(stats.total).toBe(2);
    expect(stats.byAuthor).toEqual({ alice: 1, bob: 1, carol: 1 });
  });
});
