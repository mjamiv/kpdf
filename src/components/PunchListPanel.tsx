/**
 * PunchListPanel — Punch list management panel for AEC workflows.
 *
 * Integration with App.tsx:
 *   - Maintain a `punchList: PunchList` state in App (or via a useReducer slice).
 *   - Use `createPunchList`, `addPunchItem`, `updatePunchItem`, `removePunchItem`
 *     from `../workflow/punchList` to manage state.
 *   - Pass punchList, currentUser, and callbacks as props.
 *   - Optionally wire `onNavigateToAnnotation` to jump to the linked annotation/page.
 *
 * Props:
 *   punchList              — The current PunchList object.
 *   currentUser            — The logged-in user's name.
 *   onAddItem              — Callback to add a new punch item.
 *   onUpdateItem           — Callback to update a punch item by id.
 *   onRemoveItem           — Callback to remove a punch item by id.
 *   onNavigateToAnnotation — Optional callback to navigate to a linked annotation.
 */

import { useState, useMemo, useCallback } from 'react';
import type { PunchList, PunchItem } from '../workflow/punchList';
import { filterPunchItems, sortPunchItems, exportPunchListCsv, getPunchListStats } from '../workflow/punchList';

type PunchListPanelProps = {
  punchList: PunchList;
  currentUser: string;
  onAddItem: (item: Partial<PunchItem>) => void;
  onUpdateItem: (itemId: string, patch: Partial<PunchItem>) => void;
  onRemoveItem: (itemId: string) => void;
  onNavigateToAnnotation?: (annotationId: string, page: number) => void;
};

const STATUS_OPTIONS: PunchItem['status'][] = ['open', 'in-progress', 'resolved', 'verified', 'closed'];
const PRIORITY_OPTIONS: PunchItem['priority'][] = ['low', 'medium', 'high', 'critical'];

export default function PunchListPanel({
  punchList,
  currentUser,
  onAddItem,
  onUpdateItem,
  onRemoveItem,
  onNavigateToAnnotation,
}: PunchListPanelProps) {
  // Filter state
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterAssignee, setFilterAssignee] = useState<string>('');
  const [filterPriority, setFilterPriority] = useState<string>('');
  const [filterCategory, setFilterCategory] = useState<string>('');

  // Sort state
  const [sortBy, setSortBy] = useState<'number' | 'priority' | 'status' | 'assignee' | 'dueDate'>('number');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  // Add item form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newAssignee, setNewAssignee] = useState('');
  const [newPriority, setNewPriority] = useState<PunchItem['priority']>('medium');
  const [newCategory, setNewCategory] = useState('');
  const [newPage, setNewPage] = useState(1);

  // Derived data
  const stats = useMemo(() => getPunchListStats(punchList), [punchList]);
  const assignees = useMemo(
    () => [...new Set(punchList.items.map((i) => i.assignee))].sort(),
    [punchList.items],
  );
  const categories = useMemo(
    () => [...new Set(punchList.items.map((i) => i.category).filter(Boolean))].sort(),
    [punchList.items],
  );

  const filteredItems = useMemo(() => {
    const filter: { status?: string[]; assignee?: string; priority?: string[]; category?: string } = {};
    if (filterStatus) filter.status = [filterStatus];
    if (filterAssignee) filter.assignee = filterAssignee;
    if (filterPriority) filter.priority = [filterPriority];
    if (filterCategory) filter.category = filterCategory;
    return filterPunchItems(punchList, filter);
  }, [punchList, filterStatus, filterAssignee, filterPriority, filterCategory]);

  const sortedItems = useMemo(
    () => sortPunchItems(filteredItems, sortBy, sortDir),
    [filteredItems, sortBy, sortDir],
  );

  const handleSort = useCallback((col: typeof sortBy) => {
    if (sortBy === col) {
      setSortDir((d) => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(col);
      setSortDir('asc');
    }
  }, [sortBy]);

  const handleAddItem = useCallback(() => {
    if (!newTitle.trim()) return;
    onAddItem({
      title: newTitle.trim(),
      description: newDescription.trim(),
      assignee: newAssignee.trim() || currentUser,
      priority: newPriority,
      category: newCategory.trim(),
      page: newPage,
      status: 'open',
      createdBy: currentUser,
    });
    setNewTitle('');
    setNewDescription('');
    setNewAssignee('');
    setNewPriority('medium');
    setNewCategory('');
    setShowAddForm(false);
  }, [newTitle, newDescription, newAssignee, newPriority, newCategory, newPage, currentUser, onAddItem]);

  const handleExportCsv = useCallback(() => {
    const csv = exportPunchListCsv(punchList);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${punchList.projectName}-punchlist.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }, [punchList]);

  return (
    <div className="punch-list-panel">
      <div className="punch-list-header">
        <h3>Punch List: {punchList.projectName}</h3>
        <div className="punch-list-stats">
          <span>{stats.total} items</span>
          <span>{stats.completionPercentage}% complete</span>
        </div>
      </div>

      {/* Filter bar */}
      <div className="punch-list-filters">
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} aria-label="Filter by status">
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={filterAssignee} onChange={(e) => setFilterAssignee(e.target.value)} aria-label="Filter by assignee">
          <option value="">All assignees</option>
          {assignees.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <select value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)} aria-label="Filter by priority">
          <option value="">All priorities</option>
          {PRIORITY_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} aria-label="Filter by category">
          <option value="">All categories</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Actions bar */}
      <div className="punch-list-actions">
        <button onClick={() => setShowAddForm(!showAddForm)} aria-label={showAddForm ? 'Cancel adding item' : 'Add punch list item'}>
          {showAddForm ? 'Cancel' : '+ Add Item'}
        </button>
        <button onClick={handleExportCsv} aria-label="Export punch list to CSV">Export CSV</button>
      </div>

      {/* Add form */}
      {showAddForm && (
        <div className="punch-list-add-form">
          <input
            type="text"
            placeholder="Title"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            aria-label="Item title"
          />
          <textarea
            placeholder="Description"
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
            aria-label="Item description"
          />
          <input
            type="text"
            placeholder="Assignee"
            value={newAssignee}
            onChange={(e) => setNewAssignee(e.target.value)}
            aria-label="Item assignee"
          />
          <select value={newPriority} onChange={(e) => setNewPriority(e.target.value as PunchItem['priority'])} aria-label="Item priority">
            {PRIORITY_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <input
            type="text"
            placeholder="Category"
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            aria-label="Item category"
          />
          <input
            type="number"
            placeholder="Page"
            value={newPage}
            min={1}
            onChange={(e) => setNewPage(Number(e.target.value))}
            aria-label="Item page number"
          />
          <button onClick={handleAddItem} disabled={!newTitle.trim()} aria-label="Save new item">
            Add
          </button>
        </div>
      )}

      {/* Item list */}
      <div className="punch-list-table">
        <div className="punch-list-table-header">
          <span className="pl-col-num" onClick={() => handleSort('number')}>#</span>
          <span className="pl-col-title">Title</span>
          <span className="pl-col-status" onClick={() => handleSort('status')}>Status</span>
          <span className="pl-col-priority" onClick={() => handleSort('priority')}>Priority</span>
          <span className="pl-col-assignee" onClick={() => handleSort('assignee')}>Assignee</span>
          <span className="pl-col-due" onClick={() => handleSort('dueDate')}>Due</span>
          <span className="pl-col-actions">Actions</span>
        </div>

        {sortedItems.length === 0 && (
          <div className="punch-list-empty">No items match the current filters.</div>
        )}

        {sortedItems.map((item) => (
          <div key={item.id} className={`punch-list-row priority-${item.priority}`}>
            <span className="pl-col-num">{item.number}</span>
            <span className="pl-col-title">
              {item.annotationId && onNavigateToAnnotation ? (
                <button
                  className="pl-link"
                  onClick={() => onNavigateToAnnotation(item.annotationId!, item.page)}
                  aria-label={`Navigate to ${item.title}`}
                >
                  {item.title}
                </button>
              ) : (
                item.title
              )}
            </span>
            <span className="pl-col-status">
              <select
                value={item.status}
                onChange={(e) => onUpdateItem(item.id, { status: e.target.value as PunchItem['status'] })}
                aria-label={`Status for item ${item.number}`}
              >
                {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </span>
            <span className={`pl-col-priority priority-${item.priority}`}>{item.priority}</span>
            <span className="pl-col-assignee">{item.assignee}</span>
            <span className="pl-col-due">{item.dueDate ?? '-'}</span>
            <span className="pl-col-actions">
              <button onClick={() => onRemoveItem(item.id)} title="Remove item" aria-label={`Remove item ${item.number}`}>x</button>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
