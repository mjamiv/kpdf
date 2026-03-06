import type { AnnotationsByPage, Annotation } from '../types';
import type { Action } from './actions';
import { nextZIndex } from './utils';
import { moveAnnotation, resizeAnnotation, rotateAnnotation } from './transforms';

export type DocumentState = {
  annotationsByPage: AnnotationsByPage;
};

function getPage(state: DocumentState, page: number): Annotation[] {
  return state.annotationsByPage[page] ?? [];
}

function setPage(state: DocumentState, page: number, annotations: Annotation[]): DocumentState {
  return {
    ...state,
    annotationsByPage: {
      ...state.annotationsByPage,
      [page]: annotations,
    },
  };
}

export function annotationReducer(state: DocumentState, action: Action): DocumentState {
  switch (action.type) {
    case 'ADD_ANNOTATION': {
      const page = getPage(state, action.page);
      return setPage(state, action.page, [...page, action.annotation]);
    }

    case 'REMOVE_ANNOTATION': {
      const page = getPage(state, action.page);
      return setPage(state, action.page, page.filter((a) => a.id !== action.id));
    }

    case 'UPDATE_ANNOTATION': {
      const page = getPage(state, action.page);
      return setPage(
        state,
        action.page,
        page.map((a) => (a.id === action.id ? { ...a, ...action.patch } as Annotation : a)),
      );
    }

    case 'MOVE_ANNOTATION': {
      const page = getPage(state, action.page);
      return setPage(
        state,
        action.page,
        page.map((a) => {
          if (a.id !== action.id) return a;
          return moveAnnotation(a, action.dx, action.dy);
        }),
      );
    }

    case 'RESIZE_ANNOTATION': {
      const page = getPage(state, action.page);
      return setPage(
        state,
        action.page,
        page.map((a) => {
          if (a.id !== action.id) return a;
          return resizeAnnotation(a, action.anchor, action.dx, action.dy);
        }),
      );
    }

    case 'ROTATE_ANNOTATION': {
      const page = getPage(state, action.page);
      return setPage(
        state,
        action.page,
        page.map((a) => {
          if (a.id !== action.id) return a;
          return rotateAnnotation(a, action.angle);
        }),
      );
    }

    case 'SET_Z_ORDER': {
      const page = getPage(state, action.page);
      const target = page.find((a) => a.id === action.id);
      if (!target) return state;

      const sorted = [...page].sort((a, b) => a.zIndex - b.zIndex);

      switch (action.op) {
        case 'front': {
          const maxZ = nextZIndex(page);
          return setPage(
            state,
            action.page,
            page.map((a) => (a.id === action.id ? { ...a, zIndex: maxZ } as Annotation : a)),
          );
        }
        case 'back': {
          const minZ = Math.min(...page.map((a) => a.zIndex));
          return setPage(
            state,
            action.page,
            page.map((a) => (a.id === action.id ? { ...a, zIndex: minZ - 1 } as Annotation : a)),
          );
        }
        case 'up':
        case 'down': {
          const step = action.op === 'up' ? 1 : -1;
          const idx = sorted.findIndex((a) => a.id === action.id);
          const neighborIdx = idx + step;
          if (idx < 0 || neighborIdx < 0 || neighborIdx >= sorted.length) return state;
          const neighbor = sorted[neighborIdx];
          return setPage(
            state,
            action.page,
            page.map((a) => {
              if (a.id === action.id) return { ...a, zIndex: neighbor.zIndex } as Annotation;
              if (a.id === neighbor.id) return { ...a, zIndex: target.zIndex } as Annotation;
              return a;
            }),
          );
        }
        default:
          return state;
      }
    }

    case 'LOCK_ANNOTATION': {
      const page = getPage(state, action.page);
      return setPage(
        state,
        action.page,
        page.map((a) => (a.id === action.id ? { ...a, locked: action.locked } as Annotation : a)),
      );
    }

    case 'BATCH': {
      return action.actions.reduce((s, a) => annotationReducer(s, a), state);
    }

    case 'LOAD_PAGE': {
      return setPage(state, action.page, action.annotations);
    }

    case 'CLEAR_PAGE': {
      const page = getPage(state, action.page);
      return setPage(state, action.page, page.filter((a) => a.locked));
    }

    case 'RESET_STATE':
      return { annotationsByPage: action.annotationsByPage };

    default:
      return state;
  }
}

export function computeInverse(state: DocumentState, action: Action): Action {
  switch (action.type) {
    case 'ADD_ANNOTATION':
      return { type: 'REMOVE_ANNOTATION', page: action.page, id: action.annotation.id, removed: action.annotation };

    case 'REMOVE_ANNOTATION': {
      const page = getPage(state, action.page);
      const removed = action.removed ?? page.find((a) => a.id === action.id);
      if (!removed) {
        return { type: 'BATCH', actions: [] };
      }
      return { type: 'ADD_ANNOTATION', page: action.page, annotation: removed };
    }

    case 'UPDATE_ANNOTATION': {
      const page = getPage(state, action.page);
      const current = page.find((a) => a.id === action.id);
      if (!current) {
        return { type: 'BATCH', actions: [] };
      }
      const previous: Partial<Annotation> = {};
      for (const key of Object.keys(action.patch)) {
        (previous as Record<string, unknown>)[key] = (current as Record<string, unknown>)[key];
      }
      return { type: 'UPDATE_ANNOTATION', page: action.page, id: action.id, patch: previous, previous: action.patch };
    }

    case 'MOVE_ANNOTATION':
      return { type: 'MOVE_ANNOTATION', page: action.page, id: action.id, dx: -action.dx, dy: -action.dy };

    case 'RESIZE_ANNOTATION':
      return { type: 'RESIZE_ANNOTATION', page: action.page, id: action.id, anchor: action.anchor, dx: -action.dx, dy: -action.dy };

    case 'ROTATE_ANNOTATION': {
      const page = getPage(state, action.page);
      const current = page.find((a) => a.id === action.id);
      const prevAngle = action.previousAngle ?? current?.rotation ?? 0;
      return { type: 'ROTATE_ANNOTATION', page: action.page, id: action.id, angle: prevAngle, previousAngle: action.angle };
    }

    case 'SET_Z_ORDER': {
      const inverseOps = { front: 'back', back: 'front', up: 'down', down: 'up' } as const;
      return { type: 'SET_Z_ORDER', page: action.page, id: action.id, op: inverseOps[action.op] };
    }

    case 'LOCK_ANNOTATION':
      return { type: 'LOCK_ANNOTATION', page: action.page, id: action.id, locked: !action.locked };

    case 'BATCH':
      return { type: 'BATCH', actions: [...action.actions].reverse().map((a) => computeInverse(state, a)) };

    case 'LOAD_PAGE': {
      const previous = getPage(state, action.page);
      return { type: 'LOAD_PAGE', page: action.page, annotations: previous };
    }

    case 'CLEAR_PAGE': {
      const page = getPage(state, action.page);
      const removed = action.removed ?? page.filter((a) => !a.locked);
      return { type: 'BATCH', actions: removed.map((a) => ({ type: 'ADD_ANNOTATION' as const, page: action.page, annotation: a })) };
    }

    case 'RESET_STATE':
      return { type: 'RESET_STATE', annotationsByPage: state.annotationsByPage };

    default:
      return action;
  }
}
