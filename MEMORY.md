# MEMORY

## Project Overview
kpdf is a React + Vite + TypeScript PDF markup tool using `pdfjs-dist` for rendering and `pdf-lib` for export. Annotation geometry is normalized `[0,1]` so markup stays stable across zoom.

## Completed Work

### Core platform (Phases 1-5)
- PDF viewer with 18 annotation tools (pen, rect, highlight, text, arrow, callout, cloud, measurement, polygon, stamp, ellipse, area, angle, count, dimension, polyline, hyperlink)
- Engine: reducer state, inverse-action undo/redo, hit-testing, transform ops
- 3-tier persistence: embedded attachment, sidecar JSON, localStorage
- Export: editable PDF / flattened PDF / XFDF / CSV
- Document workflow: tabs, threading, punch lists, review mode
- Collaboration: CRDT-ready sync model, presence, plugin API, cloud storage abstraction, AI assist

### Minimalist UX Overhaul (Phase 1)
- Replaced monolithic Toolbar.tsx with slim TopBar.tsx (40px) + vertical ToolRail.tsx (46px)
- 4-column layout: rail + sidebar + canvas + panel (was 3-column)
- Right panel consolidated from 5 tabs to 3: Activity (comments + punch list), Markups, AI
- Left sidebar: unified "Document" view with collapsible Sheets/Pages sections
- usePanelState: single `overlay` field replaces 5 boolean toggles
- useCommandRegistry: 8 commands migrated from toolbar to Command Palette
- StatusBar: shows active tool + "Cmd+K" hint
- Removed decorative CSS noise (gradient lines, glow box-shadows)

### Canvas & Interaction Polish (Phase 2)
- Canvas empty state: dashed-border drop zone with PDF icon + keyboard shortcut hints
- Drag overlay, busy bar, context menu, Tooltip component
- Sidebar/panel transitions smoothed, responsive breakpoints updated

### Tooltips, Handle Resize, E2E Tests (Phase 2 follow-up)
- Tooltip wired into all TopBar buttons (11) and ToolRail buttons (tools, color, pan, shortcuts)
- Selection handle drag-resize fully wired: handleHandleDown tracks anchor/pointer, dispatches RESIZE_ANNOTATION with coalesce key via window pointer events
- E2E tests rewritten for new UI: 8 empty-state tests + 8 PDF-loaded tests (tool rail, page nav, zoom, sidebar, panel tabs, tool groups)

## Key Decisions and Tradeoffs
- Kept annotation commit logic in `dispatch` so tool auto-fallback to Select happens centrally
- Persisted `fitMode` and `panX/panY` on DocumentTab for per-tab viewer context
- Transform-based free pan for full operator control
- Single `overlay` field in usePanelState ensures only one modal/popover open at a time
- Handle resize uses window-level pointer events (not canvas) since handles are in a separate DOM layer

### Red Team UX Overhaul (SOTA Viewer + Manipulation)
4-phase overhaul to make the viewer and manipulation layer production-grade.

**Phase 1 — Fluid Viewer**:
- Smooth animated zoom with CSS `scale()` interpolation + debounced re-render (range: 0.1x-8x)
- Inertial pan with momentum (velocity tracking, rAF friction at 0.92)
- Pinch-to-zoom and two-finger pan via multi-pointer tracking
- Scroll-to-zoom preference (toggle via Cmd+K, persisted to localStorage)

**Phase 2 — Live Manipulation**:
- Live drag preview: annotations follow cursor during move (offset in drawAnnotations)
- Marquee rubber-band selection in selectTool (new MarqueeDraft type)
- Hover highlight: module-level `currentHoveredId` in selectTool, drawn in drawAnnotations
- Resize handle hover states (grow + glow via onPointerEnter/Leave)
- Shift-constrain proportional resize
- Snap guide rendering infrastructure (orange dashed lines)
- Arrow-key nudge (0.001 step, 0.01 with Shift)
- Copy/Paste/Duplicate (Cmd+C/V/D) with clipboard ref
- Select All (Cmd+A) via new `selectAll()` helper in selection.ts

**Phase 3 — Tool Switching**:
- All tool groups expanded by default, collapse state persisted in localStorage
- Lock icon + right-click to lock/unlock tools on ToolRail
- Quick tool switcher in canvas context menu (5 common tools via `onSwitchTool`)
- Lock variant in Cmd+K command palette (`setLockedTool` in CommandRegistryOptions)
- Hyperlink tool shortcut: `U`
- Escape key flow: tool->select, selection->deselect

**Phase 4 — Polish**:
- Custom SVG data-URI cursors for pen, stamp, cloud, measurement/AEC tools
- Status bar always shows tool name (including select)

## Key Decisions and Tradeoffs
- Kept annotation commit logic in `dispatch` so tool auto-fallback to Select happens centrally
- Persisted `fitMode` and `panX/panY` on DocumentTab for per-tab viewer context
- Transform-based free pan for full operator control
- Single `overlay` field in usePanelState ensures only one modal/popover open at a time
- Handle resize uses window-level pointer events (not canvas) since handles are in a separate DOM layer
- Live drag preview uses draw-time offset (not state mutation) to avoid undo pollution
- Hover detection uses module-level export (`currentHoveredId`) to avoid ToolContext changes
- Marquee selection uses a separate `MarqueeDraft` type alongside `SelectDraft` in selectTool
- Proportional zoom uses multiplicative factor (1.04x) instead of fixed step for smooth trackpad input

## Current State
- Dev server: `npm run dev`
- Lint: passing
- Unit tests: **585 passing** (`npm test`)
- Build: passing (`npm run build`)

## Next Best Steps
1. Performance pass: bundle splitting, first-render profiling
2. Real E2E with Playwright runner (current tests written but not run in CI)
3. Rotation handle on selection (plumbing exists but UI not wired)
4. Multi-page virtual scroll with scroll-snap
