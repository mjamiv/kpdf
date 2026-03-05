# MEMORY

## Project Overview
kpdf is a React+Vite+TypeScript PDF viewer and markup tool. It uses pdfjs-dist for rendering and pdf-lib for export. All annotation coordinates are normalized [0,1] for zoom-agnostic storage.

## Completed Work (Phase 1 + Phase 2 + Phase 3)

### Phase 1 (baseline)
- PDF viewer with pen/rect/highlight/text tools
- 3-tier persistence: PDF attachment, sidecar JSON, localStorage
- Editable vs flattened PDF export

### Phase 2 (pro markup UX)
- Engine: reducer-based state (`useReducer`), inverse-action undo/redo (200-deep, 300ms coalescing)
- Hit-testing: distance-to-segment, point-in-polygon (ray casting), bbox for all types
- Selection: click/shift+click multi-select, locked filtering, HTML handles overlay
- Transforms: move, resize (anchor-based), rotate, z-order ops
- Tool registry: `ToolBehavior` interface with `onPointerDown/Move/Up`, `renderDraft`
- 7 new tools: arrow, callout, cloud, measurement, polygon, stamp, select
- Snapping/alignment guides, keyboard shortcuts for all tools
- Text layer extraction, text-based highlight, text search

### Phase 3 (document workflows)
- Multi-document tabs with per-tab PDF, annotations, undo history, dirty tracking
- Stamps library (6 predefined: approved, rejected, revision, draft, final, confidential)
- Comments panel with filtering by author/status/type, click-to-jump
- Review mode (read-only, select-only tool restriction)
- Report export: CSV generation with proper escaping, summary statistics

## Architecture Decisions
- **Inverse-action undo** (not snapshots) for memory efficiency
- **HTML selection handles** (not canvas) to avoid canvas redraws on hover
- **Tool behavior interface** — each tool is a pluggable module via registry
- **Normalized [0,1] coordinates** preserved across all annotation types
- **RESET_STATE action** for tab switching — replaces entire annotationsByPage
- **stateRef pattern** in App.tsx to avoid stale closure in dispatch callbacks
- **draftRef pattern** to keep draft in sync between React state and tool reads
- **Schema v2 stays** — new types are additive, backward-compatible

## Key File Paths
- App shell: `src/App.tsx` (main integration)
- Types: `src/types.ts` (all annotation types, Tool union)
- Engine: `src/engine/` (state, history, hitTest, selection, transforms, utils)
- Tools: `src/tools/` (registry, 11 tool files, snapping, shortcuts)
- PDF: `src/pdf/` (textLayer, textHighlight, search)
- Workflow: `src/workflow/` (documentStore, stamps, comments, reviewMode, reportExport)
- Components: `src/components/` (TabBar, StatusBar, SelectionHandles, ShortcutHelpPanel, CommentsPanel)
- Persistence: `src/annotationPersistence.ts`
- Export: `src/pdfExport.ts`

## Test Coverage
- 97 tests across 9 test files (all passing)
- Engine: state (20), history (11), hitTest (18), transforms (12)
- Tools: snapping (6)
- PDF: textLayer (15)
- Workflow: reportExport (6)
- Persistence: annotationPersistence (6), pdfExport (3)

## ESLint Config
- `argsIgnorePattern: '^_'` added to `@typescript-eslint/no-unused-vars` for tool no-op methods

## Git History (7 commits on main)
- Phase 1 baseline -> WP1-A (engine) -> WP1-B+WP2 (undo/selection) -> WP3+WP4 (tools/text) -> WP3-B (new tools) -> WP5-A+WP6 (integration/workflow) -> WP5-B (tabs)

### Phase 4 (UI completion + E2E)
- CommentsPanel wired into App.tsx with toggle button, filtering, click-to-jump navigation
- Review mode toggle: enforces select-only tool restriction, keyboard shortcut gating
- Cloud tool scalloped border rendering using `drawCloudShape()` shared helper (arc-based)
- Playwright E2E test infrastructure: 8 tests (5 empty-state, 3 PDF-load)
- Scripts: `test:e2e`, `test:e2e:ui`

## Not Yet Done
- Performance profiling (target: first-page <400ms, interactions >=50fps)
- Additional E2E tests for annotation tools, export, etc.
