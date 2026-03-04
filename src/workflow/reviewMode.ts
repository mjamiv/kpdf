import type { Tool } from '../types';

export type ReviewState = {
  active: boolean;
};

export function createReviewState(): ReviewState {
  return { active: false };
}

/**
 * In review mode, only 'select' tool is allowed (read-only navigation).
 */
export function isToolAllowed(tool: Tool, review: ReviewState): boolean {
  if (!review.active) return true;
  return tool === 'select';
}

/**
 * Get allowed tools for current mode.
 */
export function getAllowedTools(review: ReviewState): Tool[] {
  if (!review.active) {
    return ['select', 'pen', 'rectangle', 'highlight', 'text', 'arrow', 'callout', 'cloud', 'measurement', 'polygon', 'stamp'];
  }
  return ['select'];
}
