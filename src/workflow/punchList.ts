import { randomId } from '../engine/utils';

export type PunchItem = {
  id: string;
  number: number;
  title: string;
  description: string;
  annotationId?: string;
  page: number;
  location?: { x: number; y: number };
  assignee: string;
  status: 'open' | 'in-progress' | 'resolved' | 'verified' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'critical';
  category: string;
  dueDate?: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  photos?: string[];
};

export type PunchList = {
  id: string;
  projectName: string;
  items: PunchItem[];
  createdAt: string;
  updatedAt: string;
};

/**
 * Create a new empty punch list.
 */
export function createPunchList(projectName: string): PunchList {
  const now = new Date().toISOString();
  return {
    id: randomId(),
    projectName,
    items: [],
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Add a punch item to the list. Auto-assigns id, number, and timestamps.
 */
export function addPunchItem(
  list: PunchList,
  item: Omit<PunchItem, 'id' | 'number' | 'createdAt' | 'updatedAt'>,
): PunchList {
  const now = new Date().toISOString();
  const nextNumber = list.items.length > 0
    ? Math.max(...list.items.map((i) => i.number)) + 1
    : 1;
  const newItem: PunchItem = {
    ...item,
    id: randomId(),
    number: nextNumber,
    createdAt: now,
    updatedAt: now,
  };
  return {
    ...list,
    items: [...list.items, newItem],
    updatedAt: now,
  };
}

/**
 * Update a punch item by id with a partial patch.
 */
export function updatePunchItem(
  list: PunchList,
  itemId: string,
  patch: Partial<PunchItem>,
): PunchList {
  const now = new Date().toISOString();
  return {
    ...list,
    items: list.items.map((item) =>
      item.id === itemId ? { ...item, ...patch, updatedAt: now } : item,
    ),
    updatedAt: now,
  };
}

/**
 * Remove a punch item by id.
 */
export function removePunchItem(list: PunchList, itemId: string): PunchList {
  const now = new Date().toISOString();
  return {
    ...list,
    items: list.items.filter((item) => item.id !== itemId),
    updatedAt: now,
  };
}

/**
 * Filter punch items by criteria.
 */
export function filterPunchItems(
  list: PunchList,
  filter: {
    status?: string[];
    assignee?: string;
    priority?: string[];
    category?: string;
  },
): PunchItem[] {
  return list.items.filter((item) => {
    if (filter.status && filter.status.length > 0 && !filter.status.includes(item.status)) return false;
    if (filter.assignee && item.assignee !== filter.assignee) return false;
    if (filter.priority && filter.priority.length > 0 && !filter.priority.includes(item.priority)) return false;
    if (filter.category && item.category !== filter.category) return false;
    return true;
  });
}

/**
 * Get aggregate statistics for a punch list.
 */
export function getPunchListStats(list: PunchList): {
  total: number;
  byStatus: Record<string, number>;
  byPriority: Record<string, number>;
  byAssignee: Record<string, number>;
  completionPercentage: number;
} {
  const byStatus: Record<string, number> = {};
  const byPriority: Record<string, number> = {};
  const byAssignee: Record<string, number> = {};
  let completed = 0;

  for (const item of list.items) {
    byStatus[item.status] = (byStatus[item.status] ?? 0) + 1;
    byPriority[item.priority] = (byPriority[item.priority] ?? 0) + 1;
    byAssignee[item.assignee] = (byAssignee[item.assignee] ?? 0) + 1;
    if (item.status === 'verified' || item.status === 'closed') {
      completed++;
    }
  }

  return {
    total: list.items.length,
    byStatus,
    byPriority,
    byAssignee,
    completionPercentage: list.items.length > 0
      ? Math.round((completed / list.items.length) * 100)
      : 0,
  };
}

function escapeCsvField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Export punch list to CSV string.
 */
export function exportPunchListCsv(list: PunchList): string {
  const headers = [
    'Number', 'Title', 'Description', 'Page', 'Assignee',
    'Status', 'Priority', 'Category', 'Due Date', 'Created By', 'Created At',
  ];
  const lines = [headers.join(',')];

  for (const item of list.items) {
    const values = [
      String(item.number),
      escapeCsvField(item.title),
      escapeCsvField(item.description),
      String(item.page),
      escapeCsvField(item.assignee),
      item.status,
      item.priority,
      escapeCsvField(item.category),
      item.dueDate ?? '',
      escapeCsvField(item.createdBy),
      item.createdAt,
    ];
    lines.push(values.join(','));
  }

  return lines.join('\n');
}

const PRIORITY_ORDER: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

const STATUS_ORDER: Record<string, number> = {
  open: 0,
  'in-progress': 1,
  resolved: 2,
  verified: 3,
  closed: 4,
};

/**
 * Sort punch items by a given field.
 */
export function sortPunchItems(
  items: PunchItem[],
  by: 'number' | 'priority' | 'status' | 'assignee' | 'dueDate',
  direction: 'asc' | 'desc' = 'asc',
): PunchItem[] {
  const sorted = [...items].sort((a, b) => {
    switch (by) {
      case 'number':
        return a.number - b.number;
      case 'priority':
        return (PRIORITY_ORDER[a.priority] ?? 99) - (PRIORITY_ORDER[b.priority] ?? 99);
      case 'status':
        return (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99);
      case 'assignee':
        return a.assignee.localeCompare(b.assignee);
      case 'dueDate': {
        const da = a.dueDate ?? '';
        const db = b.dueDate ?? '';
        return da.localeCompare(db);
      }
    }
  });

  return direction === 'desc' ? sorted.reverse() : sorted;
}
