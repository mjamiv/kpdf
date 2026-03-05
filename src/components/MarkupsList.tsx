import { useCallback, useMemo, useState } from 'react';
import type { Annotation, AnnotationsByPage } from '../types';
import { generateReportRows, toCSV, downloadCSV } from '../workflow/reportExport';

type MarkupsListProps = {
  visible: boolean;
  annotationsByPage: AnnotationsByPage;
  onJumpTo: (page: number, annotationId: string) => void;
  onClose: () => void;
  onUpdateAnnotation: (page: number, id: string, patch: Partial<Annotation>) => void;
  onDeleteAnnotations: (items: Array<{ page: number; id: string }>) => void;
};

type SortKey = 'page' | 'type' | 'author' | 'color' | 'comment' | 'status' | 'createdAt' | 'locked';
type SortDir = 'asc' | 'desc';

type FlatRow = {
  page: number;
  annotation: Annotation;
};

const ALL_COLUMNS = ['#', 'Page', 'Type', 'Author', 'Color', 'Comment', 'Status', 'Date', 'Locked'] as const;
type ColumnName = (typeof ALL_COLUMNS)[number];

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return iso;
  }
}

function flattenAnnotations(annotationsByPage: AnnotationsByPage): FlatRow[] {
  const rows: FlatRow[] = [];
  for (const [pageStr, annotations] of Object.entries(annotationsByPage)) {
    const page = Number(pageStr);
    for (const ann of annotations) {
      rows.push({ page, annotation: ann });
    }
  }
  return rows;
}

function getSortValue(row: FlatRow, key: SortKey): string | number | boolean {
  switch (key) {
    case 'page': return row.page;
    case 'type': return row.annotation.type;
    case 'author': return row.annotation.author;
    case 'color': return row.annotation.color;
    case 'comment': return row.annotation.comment ?? '';
    case 'status': return row.annotation.status ?? '';
    case 'createdAt': return row.annotation.createdAt;
    case 'locked': return row.annotation.locked;
  }
}

function sortRows(rows: FlatRow[], key: SortKey, dir: SortDir): FlatRow[] {
  return [...rows].sort((a, b) => {
    const va = getSortValue(a, key);
    const vb = getSortValue(b, key);
    let cmp = 0;
    if (typeof va === 'number' && typeof vb === 'number') cmp = va - vb;
    else if (typeof va === 'boolean' && typeof vb === 'boolean') cmp = (va ? 1 : 0) - (vb ? 1 : 0);
    else cmp = String(va).localeCompare(String(vb));
    return dir === 'asc' ? cmp : -cmp;
  });
}

export default function MarkupsList({
  visible,
  annotationsByPage,
  onJumpTo,
  onClose,
  onUpdateAnnotation,
  onDeleteAnnotations,
}: MarkupsListProps) {
  const [sortKey, setSortKey] = useState<SortKey>('page');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [searchText, setSearchText] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editingCell, setEditingCell] = useState<{ id: string; field: 'comment' | 'author' | 'status' } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [visibleColumns, setVisibleColumns] = useState<Set<ColumnName>>(new Set(ALL_COLUMNS));
  const [showColumnMenu, setShowColumnMenu] = useState(false);

  const allRows = useMemo(() => flattenAnnotations(annotationsByPage), [annotationsByPage]);

  const types = useMemo(() => {
    const s = new Set<string>();
    for (const r of allRows) s.add(r.annotation.type);
    return Array.from(s).sort();
  }, [allRows]);

  const filtered = useMemo(() => {
    let rows = allRows;
    if (searchText) {
      const lower = searchText.toLowerCase();
      rows = rows.filter(
        (r) =>
          (r.annotation.comment ?? '').toLowerCase().includes(lower) ||
          r.annotation.author.toLowerCase().includes(lower),
      );
    }
    if (filterType) rows = rows.filter((r) => r.annotation.type === filterType);
    if (filterStatus) rows = rows.filter((r) => r.annotation.status === filterStatus);
    return rows;
  }, [allRows, searchText, filterType, filterStatus]);

  const sorted = useMemo(() => sortRows(filtered, sortKey, sortDir), [filtered, sortKey, sortDir]);

  const handleSort = useCallback((key: SortKey) => {
    setSortKey((prev) => {
      if (prev === key) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortDir('asc');
      }
      return key;
    });
  }, []);

  const toggleSelect = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    setSelected((prev) => {
      if (prev.size === sorted.length) return new Set();
      return new Set(sorted.map((r) => r.annotation.id));
    });
  }, [sorted]);

  const startEdit = useCallback((id: string, field: 'comment' | 'author' | 'status', currentValue: string) => {
    setEditingCell({ id, field });
    setEditValue(currentValue);
  }, []);

  const commitEdit = useCallback(() => {
    if (!editingCell) return;
    const row = allRows.find((r) => r.annotation.id === editingCell.id);
    if (row) {
      onUpdateAnnotation(row.page, editingCell.id, { [editingCell.field]: editValue } as Partial<Annotation>);
    }
    setEditingCell(null);
  }, [editingCell, editValue, allRows, onUpdateAnnotation]);

  const handleBulkDelete = useCallback(() => {
    const items = allRows
      .filter((r) => selected.has(r.annotation.id))
      .map((r) => ({ page: r.page, id: r.annotation.id }));
    onDeleteAnnotations(items);
    setSelected(new Set());
  }, [selected, allRows, onDeleteAnnotations]);

  const handleBulkStatus = useCallback((status: string) => {
    for (const row of allRows) {
      if (selected.has(row.annotation.id)) {
        onUpdateAnnotation(row.page, row.annotation.id, { status: status as 'open' | 'resolved' | 'rejected' });
      }
    }
    setSelected(new Set());
  }, [selected, allRows, onUpdateAnnotation]);

  const handleBulkLock = useCallback((locked: boolean) => {
    for (const row of allRows) {
      if (selected.has(row.annotation.id)) {
        onUpdateAnnotation(row.page, row.annotation.id, { locked });
      }
    }
    setSelected(new Set());
  }, [selected, allRows, onUpdateAnnotation]);

  const handleExportCSV = useCallback(() => {
    const rows = generateReportRows(annotationsByPage);
    const csv = toCSV(rows);
    downloadCSV(csv, 'markups-report.csv');
  }, [annotationsByPage]);

  const toggleColumn = useCallback((col: ColumnName) => {
    setVisibleColumns((prev) => {
      const next = new Set(prev);
      if (next.has(col)) next.delete(col);
      else next.add(col);
      return next;
    });
  }, []);

  const sortArrow = useCallback(
    (key: SortKey) => (sortKey === key ? (sortDir === 'asc' ? ' \u25B2' : ' \u25BC') : ''),
    [sortKey, sortDir],
  );

  if (!visible) return null;

  const col = (name: ColumnName) => visibleColumns.has(name);

  return (
    <div className="markups-panel" role="complementary" aria-label="Markups list">
      <div className="markups-header">
        <h3>Markups ({sorted.length})</h3>
        <div className="markups-header-actions">
          <button onClick={handleExportCSV} title="Export CSV" aria-label="Export CSV">
            CSV
          </button>
          <div className="markups-column-menu-wrap">
            <button
              onClick={() => setShowColumnMenu((v) => !v)}
              title="Column visibility"
              aria-label="Column visibility"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="7" cy="7" r="5.5" />
                <path d="M7 4.5v5M4.5 7h5" />
              </svg>
            </button>
            {showColumnMenu && (
              <div className="markups-column-menu">
                {ALL_COLUMNS.map((c) => (
                  <label key={c}>
                    <input
                      type="checkbox"
                      checked={visibleColumns.has(c)}
                      onChange={() => toggleColumn(c)}
                    />
                    {c}
                  </label>
                ))}
              </div>
            )}
          </div>
          <button onClick={onClose} aria-label="Close panel">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <line x1="1" y1="1" x2="11" y2="11" />
              <line x1="11" y1="1" x2="1" y2="11" />
            </svg>
          </button>
        </div>
      </div>

      <div className="markups-filters">
        <input
          type="text"
          placeholder="Search comments, author..."
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          aria-label="Search markups"
        />
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)} aria-label="Filter by type">
          <option value="">All types</option>
          {types.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} aria-label="Filter by status">
          <option value="">All statuses</option>
          <option value="open">Open</option>
          <option value="resolved">Resolved</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      {selected.size > 0 && (
        <div className="markups-bulk-bar">
          <span>{selected.size} selected</span>
          <button onClick={() => handleBulkStatus('resolved')}>Resolve</button>
          <button onClick={() => handleBulkStatus('rejected')}>Reject</button>
          <button onClick={() => handleBulkLock(true)}>Lock</button>
          <button onClick={() => handleBulkLock(false)}>Unlock</button>
          <button className="markups-bulk-delete" onClick={handleBulkDelete}>Delete</button>
        </div>
      )}

      <div className="markups-table-wrap">
        <table className="markups-table">
          <thead>
            <tr>
              <th className="markups-th-check">
                <input
                  type="checkbox"
                  checked={sorted.length > 0 && selected.size === sorted.length}
                  onChange={toggleSelectAll}
                  aria-label="Select all"
                />
              </th>
              {col('#') && <th>#</th>}
              {col('Page') && <th className="markups-sortable" onClick={() => handleSort('page')}>Page{sortArrow('page')}</th>}
              {col('Type') && <th className="markups-sortable" onClick={() => handleSort('type')}>Type{sortArrow('type')}</th>}
              {col('Author') && <th className="markups-sortable" onClick={() => handleSort('author')}>Author{sortArrow('author')}</th>}
              {col('Color') && <th className="markups-sortable" onClick={() => handleSort('color')}>Color{sortArrow('color')}</th>}
              {col('Comment') && <th className="markups-sortable" onClick={() => handleSort('comment')}>Comment{sortArrow('comment')}</th>}
              {col('Status') && <th className="markups-sortable" onClick={() => handleSort('status')}>Status{sortArrow('status')}</th>}
              {col('Date') && <th className="markups-sortable" onClick={() => handleSort('createdAt')}>Date{sortArrow('createdAt')}</th>}
              {col('Locked') && <th className="markups-sortable" onClick={() => handleSort('locked')}>Locked{sortArrow('locked')}</th>}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, idx) => {
              const ann = row.annotation;
              const isEditing = (field: string) => editingCell?.id === ann.id && editingCell?.field === field;

              return (
                <tr
                  key={ann.id}
                  className={selected.has(ann.id) ? 'markups-row-selected' : ''}
                  onClick={() => onJumpTo(row.page, ann.id)}
                >
                  <td className="markups-td-check" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selected.has(ann.id)}
                      onChange={() => toggleSelect(ann.id)}
                    />
                  </td>
                  {col('#') && <td>{idx + 1}</td>}
                  {col('Page') && <td>{row.page}</td>}
                  {col('Type') && <td>{ann.type}</td>}
                  {col('Author') && (
                    <td
                      onDoubleClick={(e) => { e.stopPropagation(); startEdit(ann.id, 'author', ann.author); }}
                    >
                      {isEditing('author') ? (
                        <input
                          className="markups-inline-edit"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={commitEdit}
                          onKeyDown={(e) => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditingCell(null); }}
                          autoFocus
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : ann.author}
                    </td>
                  )}
                  {col('Color') && (
                    <td>
                      <span className="markups-color-swatch" style={{ backgroundColor: ann.color }} />
                    </td>
                  )}
                  {col('Comment') && (
                    <td
                      className="markups-comment-cell"
                      onDoubleClick={(e) => { e.stopPropagation(); startEdit(ann.id, 'comment', ann.comment ?? ''); }}
                    >
                      {isEditing('comment') ? (
                        <input
                          className="markups-inline-edit"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={commitEdit}
                          onKeyDown={(e) => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditingCell(null); }}
                          autoFocus
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (ann.comment ?? '')}
                    </td>
                  )}
                  {col('Status') && (
                    <td
                      onDoubleClick={(e) => { e.stopPropagation(); startEdit(ann.id, 'status', ann.status ?? 'open'); }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {isEditing('status') ? (
                        <select
                          className="markups-inline-edit"
                          value={editValue}
                          onChange={(e) => { setEditValue(e.target.value); }}
                          onBlur={commitEdit}
                          autoFocus
                        >
                          <option value="open">open</option>
                          <option value="resolved">resolved</option>
                          <option value="rejected">rejected</option>
                        </select>
                      ) : (
                        <span className={`comment-status comment-status-${ann.status ?? 'open'}`}>
                          {ann.status ?? 'open'}
                        </span>
                      )}
                    </td>
                  )}
                  {col('Date') && <td className="markups-date-cell">{formatDate(ann.createdAt)}</td>}
                  {col('Locked') && <td>{ann.locked ? '\uD83D\uDD12' : ''}</td>}
                </tr>
              );
            })}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={ALL_COLUMNS.length + 1} className="markups-empty">
                  No markups found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
