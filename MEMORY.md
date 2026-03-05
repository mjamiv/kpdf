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
- Left sidebar: unified "Document" view with collapsible Sheets/Pages sections (replaced tab-based)
- usePanelState: single `overlay` field replaces 5 boolean toggles
- useCommandRegistry: 8 commands migrated from toolbar to Command Palette
- StatusBar: shows active tool + "Cmd+K" hint
- Removed decorative CSS noise (gradient lines, glow box-shadows)

### Canvas & Interaction Polish (Phase 2)
- Canvas empty state: dashed-border drop zone with PDF icon + keyboard shortcut hints
- Drag overlay: full-screen frosted glass "Drop PDF to open" on drag-over
- Busy bar: animated 2px amber progress bar at viewport top during isBusy
- Context menu: right-click on canvas for Delete/Deselect/SelectAll (ContextMenu.tsx + contextMenuItems.ts)
- Tooltip component: delayed hover tooltips with shortcut kbd badges, 4 positions (Tooltip.tsx)
- Sidebar/panel transitions smoothed (220ms, will-change hints)
- Responsive breakpoints updated for TopBar/ToolRail layout
- Old Toolbar.tsx deleted

## Key Decisions and Tradeoffs
- Kept annotation commit logic in `dispatch` so tool auto-fallback to Select happens centrally
- Persisted `fitMode` and `panX/panY` on DocumentTab for per-tab viewer context
- Transform-based free pan for full operator control
- Single `overlay` field in usePanelState ensures only one modal/popover open at a time

## Current State
- Dev server: `npm run dev`
- Lint: passing
- Unit tests: **585 passing** (`npm test`)
- Build: passing (`npm run build`)
- All changes on `main` branch, ready to commit

## Next Best Steps
1. Wire true drag-resize/rotate behavior from selection handles into reducer actions
2. Add Tooltip wrapper to TopBar and ToolRail buttons (replacing raw `title` attrs)
3. Add deeper E2E scenarios: annotation create/edit, tool lock, fit/pan flows, save/reload
4. Optional performance pass: split heavy bundle paths and profile first render/interaction FPS
