# KPDF

PDF viewer + pro markup tool for local annotation workflows.

access app live at: https://mjamiv.github.io/kpdf/

## Features

### Markup Tools (11 tools)
- **Drawing**: Pen, Rectangle, Highlight, Arrow, Polygon
- **Annotation**: Text, Callout, Cloud, Measurement, Stamp
- **Selection**: Select tool with move, z-order control, and selection handles overlay

### Viewer Controls
- Keyboard zoom: **Ctrl/Cmd +**, **Ctrl/Cmd -**, **Ctrl/Cmd 0**
- Mouse zoom: **Ctrl/Cmd + wheel** (anchor-aware zoom)
- Fit modes: **Fit Width**, **Fit Page**, plus fixed zoom presets
- Pan: toggle **Pan** mode (`H`) or hold **Space** for temporary pan
- Free pan movement (unconstrained page drag) with **Center** reset
- Page navigation: First/Prev/Next/Last, PageUp/PageDown/Home/End, direct page jump input

### Tool Interaction Model
- Default behavior returns to **Select** after creating an annotation
- Double-click a tool to **lock** it for repeated use
- Click locked tool again to **unlock**

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
- Multi-document tabs with per-tab page, zoom, fit mode, pan offsets, undo history, dirty tracking
- Stamps library: Approved, Rejected, Revision, Draft, Final, Confidential
- Comments panel with filtering by author, status, and type
- Review mode (read-only) with tool restrictions

## Stack
- React 19 + TypeScript + Vite
- `pdfjs-dist` for rendering
- `pdf-lib` for export + PDF attachment embedding
- `vitest` for unit tests (**102 tests**)

## Run
```bash
npm install
npm run dev
```
Open the Vite URL (usually `http://localhost:5173`).

## Quality Checks
```bash
npm run lint
npx vitest run src   # 102 unit tests
npm run build
```

## Project Structure
```
src/
  App.tsx                    # Main app shell and interaction controller
  App.css                    # UI styles
  types.ts                   # Annotation types, tool union, shared types
  annotationPersistence.ts   # Load/save/sidecar/localStorage
  pdfExport.ts               # PDF export with flatten + attachment embedding
  viewer/
    controls.ts              # Zoom/page/fit control math
  engine/
    actions.ts
    state.ts
    history.ts
    hitTest.ts
    selection.ts
    transforms.ts
    utils.ts
  tools/
    registry.ts
    selectTool.ts
    penTool.ts
    rectTool.ts
    textTool.ts
    arrowTool.ts
    calloutTool.ts
    cloudTool.ts
    measurementTool.ts
    polygonTool.ts
    stampTool.ts
    snapping.ts
    shortcuts.ts
  pdf/
    textLayer.ts
    textHighlight.ts
    search.ts
  components/
    TabBar.tsx
    StatusBar.tsx
    SelectionHandles.tsx
    ShortcutHelpPanel.tsx
    CommentsPanel.tsx
  workflow/
    documentStore.ts
    stamps.ts
    comments.ts
    reviewMode.ts
    reportExport.ts
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
| K | Cloud tool |
| M | Measurement tool |
| G | Polygon tool |
| S | Stamp tool |
| Ctrl/Cmd + | Zoom in |
| Ctrl/Cmd - | Zoom out |
| Ctrl/Cmd 0 | Reset zoom |
| PageUp/PageDown | Prev/Next page |
| Home/End | First/Last page |
| H (viewer) | Toggle pan mode |
| Space (hold) | Temporary pan |
| Ctrl+Z | Undo |
| Ctrl+Shift+Z | Redo |
| Delete | Remove selected |
| [ / ] | Z-order down/up |
| ? | Show shortcuts |

## Known Limitations
- Bundle size is large due to pdf.js worker (~1.2MB)
- Selection handles are visual; full handle drag-resize behavior is not fully wired yet
- E2E coverage exists but still needs deeper annotation/export scenarios
