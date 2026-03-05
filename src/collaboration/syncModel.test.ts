import { describe, it, expect } from 'vitest';
import {
  createSyncOperation,
  actionToSyncOps,
  syncOpsToAction,
  mergePresence,
  removePresence,
  type PresenceInfo,
  type CollaborationState,
  type SyncOperation,
} from './syncModel';
import type { Action } from '../engine/actions';
import type { Annotation } from '../types';

const makeAnnotation = (overrides: Record<string, unknown> = {}): Annotation => ({
  id: 'test-ann-1',
  zIndex: 1,
  color: '#ff0000',
  author: 'tester',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  locked: false,
  type: 'rectangle' as const,
  x: 0.1, y: 0.1, width: 0.2, height: 0.2, thickness: 0.0025,
  ...overrides,
} as Annotation);

describe('createSyncOperation', () => {
  it('creates an add operation', () => {
    const op = createSyncOperation('add', 'ann-1', 1, { color: '#ff0000' } as Partial<Annotation>, 'user-1');
    expect(op.type).toBe('add');
    expect(op.annotationId).toBe('ann-1');
    expect(op.page).toBe(1);
    expect(op.data).toEqual({ color: '#ff0000' });
    expect(op.userId).toBe('user-1');
    expect(op.timestamp).toBeTruthy();
  });

  it('creates a remove operation with no data', () => {
    const op = createSyncOperation('remove', 'ann-1', 1, undefined, 'user-1');
    expect(op.type).toBe('remove');
    expect(op.data).toBeUndefined();
  });
});

describe('actionToSyncOps', () => {
  it('converts ADD_ANNOTATION to add op', () => {
    const ann = makeAnnotation();
    const action: Action = { type: 'ADD_ANNOTATION', page: 1, annotation: ann };
    const ops = actionToSyncOps(action, 'user-1');
    expect(ops).toHaveLength(1);
    expect(ops[0].type).toBe('add');
    expect(ops[0].annotationId).toBe('test-ann-1');
    expect(ops[0].page).toBe(1);
    expect(ops[0].userId).toBe('user-1');
  });

  it('converts REMOVE_ANNOTATION to remove op', () => {
    const action: Action = { type: 'REMOVE_ANNOTATION', page: 2, id: 'ann-2' };
    const ops = actionToSyncOps(action, 'user-1');
    expect(ops).toHaveLength(1);
    expect(ops[0].type).toBe('remove');
    expect(ops[0].annotationId).toBe('ann-2');
    expect(ops[0].page).toBe(2);
  });

  it('converts UPDATE_ANNOTATION to update op', () => {
    const action: Action = { type: 'UPDATE_ANNOTATION', page: 1, id: 'ann-1', patch: { color: '#00ff00' } };
    const ops = actionToSyncOps(action, 'user-1');
    expect(ops).toHaveLength(1);
    expect(ops[0].type).toBe('update');
    expect(ops[0].data).toEqual({ color: '#00ff00' });
  });

  it('converts LOCK_ANNOTATION to update op', () => {
    const action: Action = { type: 'LOCK_ANNOTATION', page: 1, id: 'ann-1', locked: true };
    const ops = actionToSyncOps(action, 'user-1');
    expect(ops).toHaveLength(1);
    expect(ops[0].type).toBe('update');
    expect(ops[0].data).toEqual({ locked: true });
  });

  it('converts ROTATE_ANNOTATION to update op', () => {
    const action: Action = { type: 'ROTATE_ANNOTATION', page: 1, id: 'ann-1', angle: 45 };
    const ops = actionToSyncOps(action, 'user-1');
    expect(ops).toHaveLength(1);
    expect(ops[0].data).toEqual({ rotation: 45 });
  });

  it('converts BATCH to multiple ops', () => {
    const action: Action = {
      type: 'BATCH',
      actions: [
        { type: 'ADD_ANNOTATION', page: 1, annotation: makeAnnotation({ id: 'a1' }) },
        { type: 'REMOVE_ANNOTATION', page: 1, id: 'a2' },
      ],
    };
    const ops = actionToSyncOps(action, 'user-1');
    expect(ops).toHaveLength(2);
    expect(ops[0].type).toBe('add');
    expect(ops[1].type).toBe('remove');
  });

  it('converts LOAD_PAGE to add ops for each annotation', () => {
    const action: Action = {
      type: 'LOAD_PAGE',
      page: 3,
      annotations: [makeAnnotation({ id: 'a1' }), makeAnnotation({ id: 'a2' })],
    };
    const ops = actionToSyncOps(action, 'user-1');
    expect(ops).toHaveLength(2);
    expect(ops[0].annotationId).toBe('a1');
    expect(ops[1].annotationId).toBe('a2');
  });

  it('converts CLEAR_PAGE to remove op', () => {
    const action: Action = { type: 'CLEAR_PAGE', page: 1 };
    const ops = actionToSyncOps(action, 'user-1');
    expect(ops).toHaveLength(1);
    expect(ops[0].type).toBe('remove');
    expect(ops[0].page).toBe(1);
  });

  it('converts RESET_STATE to add ops for all pages', () => {
    const action: Action = {
      type: 'RESET_STATE',
      annotationsByPage: {
        1: [makeAnnotation({ id: 'a1' })],
        2: [makeAnnotation({ id: 'a2' }), makeAnnotation({ id: 'a3' })],
      },
    };
    const ops = actionToSyncOps(action, 'user-1');
    expect(ops).toHaveLength(3);
  });

  it('converts MOVE_ANNOTATION to update op', () => {
    const action: Action = { type: 'MOVE_ANNOTATION', page: 1, id: 'a1', dx: 0.1, dy: 0.2 };
    const ops = actionToSyncOps(action, 'user-1');
    expect(ops).toHaveLength(1);
    expect(ops[0].type).toBe('update');
  });

  it('converts SET_Z_ORDER to update op', () => {
    const action: Action = { type: 'SET_Z_ORDER', page: 1, id: 'a1', op: 'front' };
    const ops = actionToSyncOps(action, 'user-1');
    expect(ops).toHaveLength(1);
    expect(ops[0].type).toBe('update');
  });

  it('converts RESIZE_ANNOTATION to update op', () => {
    const action: Action = { type: 'RESIZE_ANNOTATION', page: 1, id: 'a1', anchor: 'se', dx: 0.05, dy: 0.05 };
    const ops = actionToSyncOps(action, 'user-1');
    expect(ops).toHaveLength(1);
    expect(ops[0].type).toBe('update');
  });
});

describe('syncOpsToAction', () => {
  it('converts single add op to ADD_ANNOTATION', () => {
    const ann = makeAnnotation();
    const ops: SyncOperation[] = [{
      type: 'add', annotationId: 'test-ann-1', page: 1,
      data: ann as Partial<Annotation>, timestamp: '', userId: 'u1',
    }];
    const action = syncOpsToAction(ops);
    expect(action.type).toBe('ADD_ANNOTATION');
    if (action.type === 'ADD_ANNOTATION') {
      expect(action.page).toBe(1);
      expect(action.annotation).toEqual(ann);
    }
  });

  it('converts single remove op to REMOVE_ANNOTATION', () => {
    const ops: SyncOperation[] = [{
      type: 'remove', annotationId: 'ann-1', page: 2,
      timestamp: '', userId: 'u1',
    }];
    const action = syncOpsToAction(ops);
    expect(action.type).toBe('REMOVE_ANNOTATION');
    if (action.type === 'REMOVE_ANNOTATION') {
      expect(action.id).toBe('ann-1');
      expect(action.page).toBe(2);
    }
  });

  it('converts single update op to UPDATE_ANNOTATION', () => {
    const ops: SyncOperation[] = [{
      type: 'update', annotationId: 'ann-1', page: 1,
      data: { color: '#00ff00' } as Partial<Annotation>,
      timestamp: '', userId: 'u1',
    }];
    const action = syncOpsToAction(ops);
    expect(action.type).toBe('UPDATE_ANNOTATION');
    if (action.type === 'UPDATE_ANNOTATION') {
      expect(action.patch).toEqual({ color: '#00ff00' });
    }
  });

  it('converts multiple ops to BATCH', () => {
    const ops: SyncOperation[] = [
      { type: 'add', annotationId: 'a1', page: 1, data: makeAnnotation({ id: 'a1' }) as Partial<Annotation>, timestamp: '', userId: 'u1' },
      { type: 'remove', annotationId: 'a2', page: 1, timestamp: '', userId: 'u1' },
    ];
    const action = syncOpsToAction(ops);
    expect(action.type).toBe('BATCH');
    if (action.type === 'BATCH') {
      expect(action.actions).toHaveLength(2);
      expect(action.actions[0].type).toBe('ADD_ANNOTATION');
      expect(action.actions[1].type).toBe('REMOVE_ANNOTATION');
    }
  });

  it('converts empty ops to empty BATCH', () => {
    const action = syncOpsToAction([]);
    expect(action.type).toBe('BATCH');
    if (action.type === 'BATCH') {
      expect(action.actions).toHaveLength(0);
    }
  });

  it('round-trips ADD_ANNOTATION', () => {
    const ann = makeAnnotation();
    const action: Action = { type: 'ADD_ANNOTATION', page: 1, annotation: ann };
    const ops = actionToSyncOps(action, 'user-1');
    const roundTripped = syncOpsToAction(ops);
    expect(roundTripped.type).toBe('ADD_ANNOTATION');
    if (roundTripped.type === 'ADD_ANNOTATION') {
      expect(roundTripped.annotation.id).toBe(ann.id);
      expect(roundTripped.page).toBe(1);
    }
  });

  it('round-trips REMOVE_ANNOTATION', () => {
    const action: Action = { type: 'REMOVE_ANNOTATION', page: 2, id: 'ann-2' };
    const ops = actionToSyncOps(action, 'user-1');
    const roundTripped = syncOpsToAction(ops);
    expect(roundTripped.type).toBe('REMOVE_ANNOTATION');
    if (roundTripped.type === 'REMOVE_ANNOTATION') {
      expect(roundTripped.id).toBe('ann-2');
      expect(roundTripped.page).toBe(2);
    }
  });

  it('round-trips UPDATE_ANNOTATION', () => {
    const action: Action = { type: 'UPDATE_ANNOTATION', page: 1, id: 'ann-1', patch: { color: '#00ff00' } };
    const ops = actionToSyncOps(action, 'user-1');
    const roundTripped = syncOpsToAction(ops);
    expect(roundTripped.type).toBe('UPDATE_ANNOTATION');
    if (roundTripped.type === 'UPDATE_ANNOTATION') {
      expect(roundTripped.patch).toEqual({ color: '#00ff00' });
    }
  });
});

describe('mergePresence', () => {
  const emptyPresence: PresenceInfo = { users: [] };

  const makeUser = (id: string, name: string): CollaborationState => ({
    userId: id,
    userName: name,
    color: '#ff0000',
    awareness: {},
  });

  it('adds a new user to empty presence', () => {
    const result = mergePresence(emptyPresence, makeUser('u1', 'Alice'));
    expect(result.users).toHaveLength(1);
    expect(result.users[0].userName).toBe('Alice');
  });

  it('adds a new user alongside existing ones', () => {
    const withAlice = mergePresence(emptyPresence, makeUser('u1', 'Alice'));
    const result = mergePresence(withAlice, makeUser('u2', 'Bob'));
    expect(result.users).toHaveLength(2);
  });

  it('updates an existing user', () => {
    const withAlice = mergePresence(emptyPresence, makeUser('u1', 'Alice'));
    const updatedAlice: CollaborationState = {
      ...makeUser('u1', 'Alice'),
      awareness: { activeTool: 'pen', viewportPage: 3 },
    };
    const result = mergePresence(withAlice, updatedAlice);
    expect(result.users).toHaveLength(1);
    expect(result.users[0].awareness.activeTool).toBe('pen');
    expect(result.users[0].awareness.viewportPage).toBe(3);
  });

  it('does not mutate original presence', () => {
    const result = mergePresence(emptyPresence, makeUser('u1', 'Alice'));
    expect(emptyPresence.users).toHaveLength(0);
    expect(result.users).toHaveLength(1);
  });
});

describe('removePresence', () => {
  it('removes a user by id', () => {
    let presence: PresenceInfo = { users: [] };
    presence = mergePresence(presence, { userId: 'u1', userName: 'Alice', color: '#f00', awareness: {} });
    presence = mergePresence(presence, { userId: 'u2', userName: 'Bob', color: '#0f0', awareness: {} });
    const result = removePresence(presence, 'u1');
    expect(result.users).toHaveLength(1);
    expect(result.users[0].userId).toBe('u2');
  });

  it('does nothing for non-existent user', () => {
    const presence: PresenceInfo = { users: [{ userId: 'u1', userName: 'Alice', color: '#f00', awareness: {} }] };
    const result = removePresence(presence, 'u99');
    expect(result.users).toHaveLength(1);
  });

  it('does not mutate original presence', () => {
    const presence: PresenceInfo = { users: [{ userId: 'u1', userName: 'Alice', color: '#f00', awareness: {} }] };
    const result = removePresence(presence, 'u1');
    expect(presence.users).toHaveLength(1);
    expect(result.users).toHaveLength(0);
  });
});
