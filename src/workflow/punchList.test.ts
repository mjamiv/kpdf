import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createPunchList,
  addPunchItem,
  updatePunchItem,
  removePunchItem,
  filterPunchItems,
  getPunchListStats,
  exportPunchListCsv,
  sortPunchItems,
  type PunchItem,
  type PunchList,
} from './punchList';

const makeItem = (overrides: Partial<PunchItem> = {}): Omit<PunchItem, 'id' | 'number' | 'createdAt' | 'updatedAt'> => ({
  title: 'Fix drywall',
  description: 'Patch hole in wall',
  page: 1,
  assignee: 'alice',
  status: 'open',
  priority: 'medium',
  category: 'Drywall',
  createdBy: 'bob',
  ...overrides,
});

describe('createPunchList', () => {
  it('creates an empty punch list', () => {
    const list = createPunchList('Building A');
    expect(list.projectName).toBe('Building A');
    expect(list.items).toEqual([]);
    expect(list.id).toBeTruthy();
    expect(list.createdAt).toBeTruthy();
  });
});

describe('addPunchItem', () => {
  it('adds an item with auto-assigned id and number', () => {
    const list = createPunchList('Test');
    const updated = addPunchItem(list, makeItem());
    expect(updated.items).toHaveLength(1);
    expect(updated.items[0].number).toBe(1);
    expect(updated.items[0].id).toBeTruthy();
    expect(updated.items[0].title).toBe('Fix drywall');
  });

  it('increments number for subsequent items', () => {
    let list = createPunchList('Test');
    list = addPunchItem(list, makeItem({ title: 'Item 1' }));
    list = addPunchItem(list, makeItem({ title: 'Item 2' }));
    list = addPunchItem(list, makeItem({ title: 'Item 3' }));
    expect(list.items.map((i) => i.number)).toEqual([1, 2, 3]);
  });

  it('does not mutate original list', () => {
    const list = createPunchList('Test');
    const updated = addPunchItem(list, makeItem());
    expect(list.items).toHaveLength(0);
    expect(updated.items).toHaveLength(1);
  });
});

describe('updatePunchItem', () => {
  it('updates item fields', () => {
    let list = createPunchList('Test');
    list = addPunchItem(list, makeItem());
    const itemId = list.items[0].id;
    const updated = updatePunchItem(list, itemId, { status: 'resolved', priority: 'high' });
    expect(updated.items[0].status).toBe('resolved');
    expect(updated.items[0].priority).toBe('high');
    expect(updated.items[0].title).toBe('Fix drywall'); // unchanged
  });

  it('does not mutate original list', () => {
    let list = createPunchList('Test');
    list = addPunchItem(list, makeItem());
    const itemId = list.items[0].id;
    const updated = updatePunchItem(list, itemId, { status: 'closed' });
    expect(list.items[0].status).toBe('open');
    expect(updated.items[0].status).toBe('closed');
  });

  it('sets updatedAt timestamp', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T00:00:00Z'));
    let list = createPunchList('Test');
    list = addPunchItem(list, makeItem());
    const itemId = list.items[0].id;
    const before = list.items[0].updatedAt;
    vi.setSystemTime(new Date('2024-01-01T00:01:00Z'));
    const updated = updatePunchItem(list, itemId, { title: 'New title' });
    expect(updated.items[0].updatedAt).not.toBe(before);
    vi.useRealTimers();
  });
});

describe('removePunchItem', () => {
  it('removes item by id', () => {
    let list = createPunchList('Test');
    list = addPunchItem(list, makeItem({ title: 'A' }));
    list = addPunchItem(list, makeItem({ title: 'B' }));
    const idToRemove = list.items[0].id;
    const updated = removePunchItem(list, idToRemove);
    expect(updated.items).toHaveLength(1);
    expect(updated.items[0].title).toBe('B');
  });

  it('does nothing for non-existent id', () => {
    let list = createPunchList('Test');
    list = addPunchItem(list, makeItem());
    const updated = removePunchItem(list, 'nonexistent');
    expect(updated.items).toHaveLength(1);
  });
});

describe('filterPunchItems', () => {
  let list: PunchList;

  beforeEach(() => {
    list = createPunchList('Test');
    list = addPunchItem(list, makeItem({ title: 'A', status: 'open', priority: 'high', assignee: 'alice', category: 'Drywall' }));
    list = addPunchItem(list, makeItem({ title: 'B', status: 'resolved', priority: 'low', assignee: 'bob', category: 'Electrical' }));
    list = addPunchItem(list, makeItem({ title: 'C', status: 'open', priority: 'high', assignee: 'alice', category: 'Drywall' }));
  });

  it('filters by status', () => {
    const result = filterPunchItems(list, { status: ['open'] });
    expect(result).toHaveLength(2);
    expect(result.every((i) => i.status === 'open')).toBe(true);
  });

  it('filters by multiple statuses', () => {
    const result = filterPunchItems(list, { status: ['open', 'resolved'] });
    expect(result).toHaveLength(3);
  });

  it('filters by assignee', () => {
    const result = filterPunchItems(list, { assignee: 'bob' });
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('B');
  });

  it('filters by priority', () => {
    const result = filterPunchItems(list, { priority: ['high'] });
    expect(result).toHaveLength(2);
  });

  it('filters by category', () => {
    const result = filterPunchItems(list, { category: 'Electrical' });
    expect(result).toHaveLength(1);
  });

  it('combines multiple filters', () => {
    const result = filterPunchItems(list, { status: ['open'], assignee: 'alice' });
    expect(result).toHaveLength(2);
  });

  it('returns all items with empty filter', () => {
    const result = filterPunchItems(list, {});
    expect(result).toHaveLength(3);
  });
});

describe('getPunchListStats', () => {
  it('returns zero stats for empty list', () => {
    const list = createPunchList('Test');
    const stats = getPunchListStats(list);
    expect(stats).toEqual({
      total: 0,
      byStatus: {},
      byPriority: {},
      byAssignee: {},
      completionPercentage: 0,
    });
  });

  it('computes stats correctly', () => {
    let list = createPunchList('Test');
    list = addPunchItem(list, makeItem({ status: 'open', priority: 'high', assignee: 'alice' }));
    list = addPunchItem(list, makeItem({ status: 'verified', priority: 'medium', assignee: 'bob' }));
    list = addPunchItem(list, makeItem({ status: 'closed', priority: 'low', assignee: 'alice' }));
    list = addPunchItem(list, makeItem({ status: 'open', priority: 'high', assignee: 'carol' }));

    const stats = getPunchListStats(list);
    expect(stats.total).toBe(4);
    expect(stats.byStatus).toEqual({ open: 2, verified: 1, closed: 1 });
    expect(stats.byPriority).toEqual({ high: 2, medium: 1, low: 1 });
    expect(stats.byAssignee).toEqual({ alice: 2, bob: 1, carol: 1 });
    expect(stats.completionPercentage).toBe(50); // 2 of 4 are verified/closed
  });
});

describe('exportPunchListCsv', () => {
  it('generates CSV with headers', () => {
    let list = createPunchList('Test Project');
    list = addPunchItem(list, makeItem());
    const csv = exportPunchListCsv(list);
    const lines = csv.split('\n');
    expect(lines[0]).toBe('Number,Title,Description,Page,Assignee,Status,Priority,Category,Due Date,Created By,Created At');
    expect(lines).toHaveLength(2); // header + 1 row
  });

  it('escapes fields with commas', () => {
    let list = createPunchList('Test');
    list = addPunchItem(list, makeItem({ title: 'Fix, repair' }));
    const csv = exportPunchListCsv(list);
    expect(csv).toContain('"Fix, repair"');
  });

  it('escapes fields with quotes', () => {
    let list = createPunchList('Test');
    list = addPunchItem(list, makeItem({ description: 'He said "hello"' }));
    const csv = exportPunchListCsv(list);
    expect(csv).toContain('"He said ""hello"""');
  });

  it('handles empty list', () => {
    const list = createPunchList('Test');
    const csv = exportPunchListCsv(list);
    const lines = csv.split('\n');
    expect(lines).toHaveLength(1); // header only
  });
});

describe('sortPunchItems', () => {
  const items: PunchItem[] = [
    { id: '1', number: 3, title: 'C', description: '', page: 1, assignee: 'carol', status: 'resolved', priority: 'low', category: '', createdAt: '', updatedAt: '', createdBy: 'x', dueDate: '2024-03-01' },
    { id: '2', number: 1, title: 'A', description: '', page: 1, assignee: 'alice', status: 'open', priority: 'critical', category: '', createdAt: '', updatedAt: '', createdBy: 'x', dueDate: '2024-01-01' },
    { id: '3', number: 2, title: 'B', description: '', page: 1, assignee: 'bob', status: 'in-progress', priority: 'high', category: '', createdAt: '', updatedAt: '', createdBy: 'x', dueDate: '2024-02-01' },
  ];

  it('sorts by number ascending', () => {
    const sorted = sortPunchItems(items, 'number', 'asc');
    expect(sorted.map((i) => i.number)).toEqual([1, 2, 3]);
  });

  it('sorts by number descending', () => {
    const sorted = sortPunchItems(items, 'number', 'desc');
    expect(sorted.map((i) => i.number)).toEqual([3, 2, 1]);
  });

  it('sorts by priority (critical first)', () => {
    const sorted = sortPunchItems(items, 'priority', 'asc');
    expect(sorted.map((i) => i.priority)).toEqual(['critical', 'high', 'low']);
  });

  it('sorts by priority descending (low first)', () => {
    const sorted = sortPunchItems(items, 'priority', 'desc');
    expect(sorted.map((i) => i.priority)).toEqual(['low', 'high', 'critical']);
  });

  it('sorts by status', () => {
    const sorted = sortPunchItems(items, 'status', 'asc');
    expect(sorted.map((i) => i.status)).toEqual(['open', 'in-progress', 'resolved']);
  });

  it('sorts by assignee', () => {
    const sorted = sortPunchItems(items, 'assignee', 'asc');
    expect(sorted.map((i) => i.assignee)).toEqual(['alice', 'bob', 'carol']);
  });

  it('sorts by dueDate', () => {
    const sorted = sortPunchItems(items, 'dueDate', 'asc');
    expect(sorted.map((i) => i.dueDate)).toEqual(['2024-01-01', '2024-02-01', '2024-03-01']);
  });

  it('does not mutate original array', () => {
    const original = [...items];
    sortPunchItems(items, 'number', 'asc');
    expect(items.map((i) => i.id)).toEqual(original.map((i) => i.id));
  });
});
