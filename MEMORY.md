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

### Smooth Zoom + Zoom Window Session
- Replaced fixed 1.04x zoom factor with exponential curve (`Math.exp(delta * sensitivity)`) for smooth, proportional ctrl+scroll zoom
- Tripled zoom sensitivity (0.006→0.018 pixel mode, 0.04→0.12 line mode) so less scrolling = more zoom
- Fixed `clampZoom` quantization: `.toFixed(2)` → 4-decimal-place rounding to eliminate sticky snapping
- CSS transition on `.page-wrap` temporarily disabled during active wheel zoom to prevent jitter
- Reduced hi-res re-render debounce from 200ms to 80ms for snappier convergence
- Added Zoom Window mode: draw a box to zoom into a specific area
  - Viewer mode (like pan), not an annotation tool — handled in App.tsx pointer handlers
  - Rubber-band rectangle overlay with `zoom-in` cursor
  - Computes scale from box-to-viewport ratio, scrolls to center the selected area
  - One-shot: auto-deactivates after each use
  - Keyboard shortcut: `W`, command palette entry, tool rail button (magnifier icon)
  - Escape cancels zoom-window mode

### Gold-Team Investor Review
5-agent review to make the app investor-presentation ready.

**Agent 1 — Brand & First Impression**:
- Created `public/kpdf.svg` favicon (terminal `>_` motif from brand spec)
- Updated `index.html`: branded title, meta description, Open Graph tags, theme-color
- Deleted scaffold leftover `src/assets/react.svg`
- Set `base: '/kpdf/'` in `vite.config.ts` for GitHub Pages deployment
- Branded TopBar title: `kpdf@local` → `KPDF`

**Agent 2 — Keyboard Shortcuts & Interaction Fixes**:
- Wired Cmd+O (open file) and Cmd+S (save) keyboard shortcuts
- Moved Cmd+K and Cmd+O above `!pdfDoc` guard so they work on empty state
- Removed non-functional "Accept" button from AI group suggestions
- Fixed pre-existing build error: moved `toggleZoomWindow` above its usage in useEffect deps

**Agent 3 — Theme Consistency & UI Polish**:
- Migrated StorageBrowser.tsx from ~15 inline styles to CSS classes with `--kpdf-*` design tokens
- Migrated AIAssistPanel.tsx from inline styles to CSS classes with design tokens
- Removed exposed annotation IDs from AI panel UI
- Added CSS spinner (`.kpdf-spinner`) for loading states
- Replaced 9 hardcoded hex colors in App.css with design token references
- Added error emphasis to StatusBar (red dot + text for error messages)

**Agent 4 — Performance**:
- Lazy-loaded `pdfjs-dist` via dynamic import (`getPdfjs()` helper) — initial bundle reduced ~400KB
- Wrapped 7 pure components in `React.memo`: StatusBar, TabBar, PanelLayout, LeftSidebar, RightPanel, ToolRail, TopBar
- Wrapped `toNormalizedPoint` in `useCallback` for stable reference

**Agent 5 — Accessibility**:
- Added 20+ `aria-label` attributes across ThreadedComments, PunchListPanel, LeftSidebar, App.tsx
- Added `aria-hidden="true"` to decorative SVGs (chevrons, icons)
- Added `aria-label` to 3 hidden file inputs

**Bonus**: Fixed pre-existing `clampZoom` test (2-decimal → 4-decimal expectation)

## Current State
- Dev server: `npm run dev`
- Lint: passing (0 errors, 3 pre-existing warnings)
- Unit tests: **585 passing** (`npm test`)
- Build: passing (`npm run build`)
- pdfjs-dist is now code-split (loaded on first PDF open)

## Next Best Steps
1. Real E2E with Playwright runner (current tests written but not run in CI)
2. Rotation handle on selection (plumbing exists but UI not wired)
3. Multi-page virtual scroll with scroll-snap
4. WebSocket collaboration backend
5. GitHub Actions CI/CD pipeline for automated build, test, and deploy
