# MEMORY

## Project Overview
kpdf is a React + Vite + TypeScript PDF markup tool using `pdfjs-dist` for rendering and `pdf-lib` for export. Annotation geometry is normalized `[0,1]` so markup stays stable across zoom.

## Completed Work

### Core platform (Phases 1-4)
- PDF viewer with pen/rect/highlight/text baseline tools
- Engine refactor: reducer state, inverse-action undo/redo, hit-testing, transform ops
- Extended toolset: select, arrow, callout, cloud, measurement, polygon, stamp
- 3-tier persistence: embedded attachment, sidecar JSON, localStorage
- Export: editable PDF / flattened PDF + sidecar + CSV report
- Document workflow: tabs, dirty tracking, comments panel, review mode
- E2E infra with Playwright (empty-state + PDF-load checks)

### Latest session (viewer and interaction overhaul)
- Toolbar and control UX redesigned in `src/App.tsx` + `src/App.css`
- Tool behavior model implemented:
  - auto-return to **Select** after creating an annotation
  - double-click tool to lock
  - click locked tool to unlock
- Viewer controls added/upgraded:
  - Ctrl/Cmd `+`, `-`, `0`
  - Ctrl/Cmd + wheel anchor zoom
  - zoom presets
  - Fit Width and Fit Page modes (per-tab fit state)
  - page jump input + First/Prev/Next/Last + Home/End/PageUp/PageDown
- Pan behavior upgraded:
  - pan mode toggle (`H`) + temporary pan (`Space` hold)
  - unconstrained free page drag using per-tab pan offsets
  - Center reset action
- New viewer control utility module + tests:
  - `src/viewer/controls.ts`
  - `src/viewer/controls.test.ts`

## Key Decisions and Tradeoffs
- Kept annotation commit logic in `dispatch` so tool auto-fallback to Select happens centrally.
- Persisted `fitMode` and `panX/panY` on `DocumentTab` to keep per-tab viewer context stable.
- Switched from scroll-bound pan to transform-based free pan for full operator control.
- Added `Center` reset to counter the downside of unconstrained pan (possible off-screen drift).

## Current State
- Dev server: runs locally via `npm run dev`
- Lint: passing
- Unit tests: **102 passing** (`npx vitest run src`)
- Build: passing (`npm run build`)
- Working tree includes large App/UI changes plus doc updates.

## Next Best Steps
1. Wire true drag-resize/rotate behavior from selection handles into reducer actions.
2. Add deeper E2E scenarios: annotation create/edit, tool lock behavior, fit/pan flows, save/reload loop.
3. Optional performance pass: split heavy bundle paths and profile first render/interaction FPS.
