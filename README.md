# KPDF

PDF viewer + pro markup tool for local annotation workflows.

## Features

### Markup Tools (11 tools)
- **Drawing**: Pen, Rectangle, Highlight, Arrow, Polygon
- **Annotation**: Text, Callout, Cloud, Measurement, Stamp
- **Selection**: Select tool with move, resize, and z-order control

### Engine
- Reducer-based state with full undo/redo (200-deep, coalesced drag actions)
- Hit-testing for all annotation types (point-in-polygon, distance-to-segment)
- Selection system with multi-select (shift+click), locked annotation filtering
- Transform operations: move, resize, rotate, z-order (front/back/up/down)
- Snapping/alignment guides with configurable tolerance

### Persistence (3-tier)
- **Embedded**: PDF attachment (`kpdf-annotations-v2.json`) for portable editable files
- **Sidecar**: JSON export (`.kpdf.json`) always generated for recovery
- **Local**: localStorage autosave by PDF fingerprint
- Legacy keyword metadata read compatibility

### Export
- **Editable PDF**: embeds annotation payload as PDF attachment
- **Flattened PDF**: burns markup permanently into page content
- **CSV report**: annotation summary with page, type, author, status, coordinates
- Sidecar JSON alongside every save

### Document Workflow
- Multi-document tabs with per-tab state, undo history, and dirty tracking
- Stamps library: Approved, Rejected, Revision, Draft, Final, Confidential
- Comments panel with filtering by author, status, and type
- Review mode (read-only) with tool restrictions
- Keyboard shortcuts for all tools and actions

### PDF Intelligence
- Text layer extraction via `pdfjs` `getTextContent()`
- Text-based highlighting with span position tracking
- Text search with case-sensitive option

## Stack
- React 19 + TypeScript + Vite
- `pdfjs-dist` for rendering
- `pdf-lib` for export + PDF attachment embedding
- `vitest` for unit tests (153 tests)

## Run
```bash
npm install
npm run dev
```
Open the Vite URL (usually `http://localhost:5173`).

## Quality Checks
```bash
npm run test    # 153 unit tests
npm run lint    # ESLint
npm run build   # TypeScript + Vite build
```

## Project Structure
```
src/
  App.tsx                    # Main app shell with useReducer, tool system, tabs
  App.css                    # All styles
  types.ts                   # Annotation types, tool union, shared types
  annotationPersistence.ts   # Load/save/sidecar/localStorage
  pdfExport.ts               # PDF export with flatten + attachment embedding
  engine/
    actions.ts               # Action type union (13 action types)
    state.ts                 # annotationReducer + computeInverse
    history.ts               # UndoStack with coalescing (300ms window)
    hitTest.ts               # Hit-testing for all annotation types
    selection.ts             # Selection state management
    transforms.ts            # Move/resize/rotate/z-order transforms
    utils.ts                 # clamp01, randomId, normalizeRect, etc.
  tools/
    registry.ts              # ToolBehavior interface + tool registry
    selectTool.ts            # Select, move, multi-select
    penTool.ts               # Freehand drawing
    rectTool.ts              # Rectangle + highlight
    textTool.ts              # Text placement
    arrowTool.ts             # Two-point arrow with head
    calloutTool.ts           # Box + leader line + text
    cloudTool.ts             # Scalloped-border rectangle
    measurementTool.ts       # Distance measurement with label
    polygonTool.ts           # Multi-click polygon, close on first point
    stampTool.ts             # Click-to-place stamp
    snapping.ts              # Alignment guides
    shortcuts.ts             # Keyboard shortcut mapping
  pdf/
    textLayer.ts             # PDF text extraction + positioning
    textHighlight.ts         # Text-based highlight computation
    search.ts                # Full-text search
  components/
    TabBar.tsx               # Multi-document tab bar
    StatusBar.tsx             # Status message footer
    SelectionHandles.tsx     # HTML resize/rotate handles overlay
    ShortcutHelpPanel.tsx    # Keyboard shortcuts modal
    CommentsPanel.tsx        # Comment list with filtering
  workflow/
    documentStore.ts         # Tab data model with dirty tracking
    stamps.ts                # Stamp library (6 predefined stamps)
    comments.ts              # Comment extraction + filtering
    reviewMode.ts            # Read-only mode + tool restrictions
    reportExport.ts          # CSV report generation + download
```

## Keyboard Shortcuts
| Key | Action |
|-----|--------|
| V | Select tool |
| P | Pen tool |
| R | Rectangle tool |
| H | Highlight tool |
| T | Text tool |
| A | Arrow tool |
| C | Callout tool |
| O | Cloud tool |
| M | Measurement tool |
| G | Polygon tool |
| S | Stamp tool |
| Ctrl+Z | Undo |
| Ctrl+Shift+Z | Redo |
| Delete | Remove selected |
| [ / ] | Z-order down/up |
| ? | Show shortcuts |

### UX & Accessibility
- Professional dark-theme design system with CSS custom properties
- ARIA roles/attributes on toolbar, tabs, status bar, and panels
- Focus-visible outlines for keyboard navigation
- Interactive zoom and page number inputs (click-to-edit)
- Locked annotation visual indicator (dashed border + lock icon)
- Inline text input overlay (replaces browser prompt)
- Drag-over visual feedback for file drops
- Loading spinner during PDF load
- Beforeunload guard for unsaved changes

### Performance
- Dynamic `import()` for pdf-lib (435 kB main + 654 kB lazy chunk)
- Debounced localStorage autosave (1.5s)
- Batched drag dispatches (single action on pointerUp)
- O(1) pen point append (mutable push)
- Cached canvasRect via ResizeObserver for coordinate conversion
- Split PDF render useEffect (only re-renders on page/zoom change)

## Known Limitations
- Bundle size is large due to pdf.js worker (~1.2MB)
- No E2E tests yet (Playwright planned)
- Cloud tool renders as simple rectangle (scalloped border is visual only in export)
