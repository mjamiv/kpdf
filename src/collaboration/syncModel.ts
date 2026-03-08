import type { Annotation } from '../types';
import type { Action } from '../engine/actions';

/**
 * Collaboration data layer: CRDT-ready data structures.
 * This module provides local-first sync primitives in a Yjs-compatible shape.
 * Actual Yjs integration will be added in a future phase when server infra is ready.
 */

export type UserAwareness = {
  cursor?: { page: number; x: number; y: number };
  activeTool?: string;
  selectedIds?: string[];
  viewportPage?: number;
};

export type CollaborationState = {
  userId: string;
  userName: string;
  color: string;
  awareness: UserAwareness;
};

export type PresenceInfo = {
  users: CollaborationState[];
};

/**
 * Data payload for sync operations. Extends Partial<Annotation> with
 * special fields for move, resize, and z-order operations that don't
 * map directly to annotation properties.
 */
export type SyncOperationData = Partial<Annotation> & {
  _move?: { dx: number; dy: number };
  _resize?: { anchor: string; dx: number; dy: number };
  _zOrder?: string;
};

export type SyncOperation = {
  type: 'add' | 'update' | 'remove';
  annotationId: string;
  page: number;
  data?: SyncOperationData;
  timestamp: string;
  userId: string;
};

/**
 * Create a single sync operation.
 */
export function createSyncOperation(
  type: 'add' | 'update' | 'remove',
  annotationId: string,
  page: number,
  data: Partial<Annotation> | undefined,
  userId: string,
): SyncOperation {
  return {
    type,
    annotationId,
    page,
    data,
    timestamp: new Date().toISOString(),
    userId,
  };
}

/**
 * Convert an engine Action to sync operations.
 * This allows local actions to be broadcast to remote peers.
 */
export function actionToSyncOps(action: Action, userId: string): SyncOperation[] {
  const now = new Date().toISOString();

  switch (action.type) {
    case 'ADD_ANNOTATION':
      return [{
        type: 'add',
        annotationId: action.annotation.id,
        page: action.page,
        data: action.annotation as SyncOperationData,
        timestamp: now,
        userId,
      }];

    case 'REMOVE_ANNOTATION':
      return [{
        type: 'remove',
        annotationId: action.id,
        page: action.page,
        timestamp: now,
        userId,
      }];

    case 'UPDATE_ANNOTATION':
      return [{
        type: 'update',
        annotationId: action.id,
        page: action.page,
        data: action.patch as SyncOperationData,
        timestamp: now,
        userId,
      }];

    case 'MOVE_ANNOTATION':
      return [{
        type: 'update',
        annotationId: action.id,
        page: action.page,
        data: { _move: { dx: action.dx, dy: action.dy } },
        timestamp: now,
        userId,
      }];

    case 'RESIZE_ANNOTATION':
      return [{
        type: 'update',
        annotationId: action.id,
        page: action.page,
        data: { _resize: { anchor: action.anchor, dx: action.dx, dy: action.dy } },
        timestamp: now,
        userId,
      }];

    case 'ROTATE_ANNOTATION':
      return [{
        type: 'update',
        annotationId: action.id,
        page: action.page,
        data: { rotation: action.angle },
        timestamp: now,
        userId,
      }];

    case 'LOCK_ANNOTATION':
      return [{
        type: 'update',
        annotationId: action.id,
        page: action.page,
        data: { locked: action.locked },
        timestamp: now,
        userId,
      }];

    case 'SET_Z_ORDER':
      return [{
        type: 'update',
        annotationId: action.id,
        page: action.page,
        data: { _zOrder: action.op },
        timestamp: now,
        userId,
      }];

    case 'BATCH':
      return action.actions.flatMap((a) => actionToSyncOps(a, userId));

    case 'CLEAR_PAGE':
      // Represent as remove ops for each annotation that was on the page
      // Since we may not have annotation IDs, emit a single synthetic op
      return [{
        type: 'remove',
        annotationId: '__clear_page__',
        page: action.page,
        timestamp: now,
        userId,
      }];

    case 'LOAD_PAGE':
      return action.annotations.map((ann) => ({
        type: 'add' as const,
        annotationId: ann.id,
        page: action.page,
        data: ann as SyncOperationData,
        timestamp: now,
        userId,
      }));

    case 'RESET_STATE':
      // Full state reset: emit add ops for all annotations across all pages
      return Object.entries(action.annotationsByPage).flatMap(([pageStr, annotations]) =>
        annotations.map((ann) => ({
          type: 'add' as const,
          annotationId: ann.id,
          page: Number(pageStr),
          data: ann as SyncOperationData,
          timestamp: now,
          userId,
        })),
      );
  }
}

/**
 * Convert sync operations back to engine Actions.
 * This allows remote operations to be applied to the local state.
 */
export function syncOpsToAction(ops: SyncOperation[]): Action {
  if (ops.length === 0) {
    return { type: 'BATCH', actions: [] };
  }

  if (ops.length === 1) {
    const op = ops[0];
    switch (op.type) {
      case 'add':
        return {
          type: 'ADD_ANNOTATION',
          page: op.page,
          annotation: op.data as Annotation,
        };
      case 'remove':
        return {
          type: 'REMOVE_ANNOTATION',
          page: op.page,
          id: op.annotationId,
        };
      case 'update':
        return {
          type: 'UPDATE_ANNOTATION',
          page: op.page,
          id: op.annotationId,
          patch: op.data as SyncOperationData,
        };
    }
  }

  // Multiple ops: wrap in a BATCH
  const actions: Action[] = ops.map((op) => {
    switch (op.type) {
      case 'add':
        return {
          type: 'ADD_ANNOTATION' as const,
          page: op.page,
          annotation: op.data as Annotation,
        };
      case 'remove':
        return {
          type: 'REMOVE_ANNOTATION' as const,
          page: op.page,
          id: op.annotationId,
        };
      case 'update':
        return {
          type: 'UPDATE_ANNOTATION' as const,
          page: op.page,
          id: op.annotationId,
          patch: op.data as SyncOperationData,
        };
    }
  });

  return { type: 'BATCH', actions };
}

/**
 * Add or update a user's presence info.
 */
export function mergePresence(
  current: PresenceInfo,
  update: CollaborationState,
): PresenceInfo {
  const existing = current.users.findIndex((u) => u.userId === update.userId);
  if (existing >= 0) {
    const users = [...current.users];
    users[existing] = update;
    return { users };
  }
  return { users: [...current.users, update] };
}

/**
 * Remove a user from presence info (e.g., on disconnect).
 */
export function removePresence(
  current: PresenceInfo,
  userId: string,
): PresenceInfo {
  return { users: current.users.filter((u) => u.userId !== userId) };
}
