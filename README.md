# KPDF

PDF viewer + professional AEC markup tool for local annotation workflows.

Access app live at: https://mjamiv.github.io/kpdf/

## Features

### Markup Tools (18 tools)
- **Basic**: Select, Pen (variable-width), Rectangle, Highlight, Text, Ellipse
- **Shapes**: Arrow, Callout, Cloud, Polygon, Polyline
- **AEC**: Measurement, Area, Angle, Count, Dimension
- **Other**: Stamp (with custom stamp library), Hyperlink (cross-page links)

### Professional UI
- **Toolbar**: Grouped icon-based tools with category color accents (Basic/Shapes/AEC/Stamp)
- **Left sidebar**: Sheet Index (auto-detected AEC sheet IDs) and page navigation
- **Right panel**: Tabbed interface with Comments, Markups List, Punch List, Properties, and AI Assist
- **Command palette**: Fuzzy-search commands via Cmd+K / Ctrl+K
- **Responsive**: Icon-only toolbar at 980px, overlay sidebars at 768px

### Viewer Controls
- Keyboard zoom: **Ctrl/Cmd +**, **Ctrl/Cmd -**, **Ctrl/Cmd 0**
- Mouse zoom: **Ctrl/Cmd + wheel** (anchor-aware zoom)
- Fit modes: **Fit Width**, **Fit Page**, plus fixed zoom presets
- Pan: toggle **Pan** mode (`H`) or hold **Space** for temporary pan
- Page navigation with back/forward history breadcrumbs

### Tool Interaction Model
- Default behavior returns to **Select** after creating an annotation
- Double-click a tool to **lock** it for repeated use
- Shift-key constraints (45° angles, squares, circles)
- Tool presets for discipline-specific workflows (Electrical, Structural, Plumbing, etc.)
- Scale calibration for real-world measurement annotations

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
- **XFDF**: ISO 19444 format for interchange with Bluebeam/Acrobat
- **CSV report**: annotation summary with page, type, author, status, coordinates
- Sidecar JSON alongside every save

### Document Workflow
- Multi-document tabs with per-tab page, zoom, fit mode, pan offsets, undo history, dirty tracking
- Stamps library: Approved, Rejected, Revision, Draft, Final, Confidential + custom stamps
- Comments panel with threaded discussions, @mentions, resolve/reopen
- Punch list management (CRUD, filtering, sorting, CSV export)
- Review mode (read-only) with tool restrictions
- Markups list panel (sortable, filterable, inline edit, bulk ops)

### Collaboration & Platform
- Presence indicators (placeholder for WebSocket integration)
- CRDT-ready sync model for future real-time collaboration
- Plugin API with 3 built-in plugins (word count, annotation stats, auto-save)
- Cloud storage abstraction with IndexedDB local provider
- AI assist panel (local heuristic classification, grouping, auto-labeling)

### Accessibility
- ARIA landmarks, labels, and live regions
- Skip navigation link
- Focus trapping on modal overlays
- Keyboard-navigable command palette
- Screen reader announcements for tool changes, page navigation, and actions

## Stack
- React 19 + TypeScript + Vite
- `pdfjs-dist` for rendering
- `pdf-lib` for export + PDF attachment embedding (lazy-loaded)
- `perfect-freehand` for variable-width pen strokes
- `vitest` for unit tests (**585 tests**)

## Run
```bash
npm install
npm run dev
```
Open the Vite URL (usually `http://localhost:5173`).

## Quality Checks
```bash
npm run lint        # ESLint
npm run test        # 585 vitest tests
npm run build       # TypeScript + Vite production build
```

## Project Structure
```
src/
  App.tsx                    # Main app shell (~550 lines)
  App.css                    # UI styles (layout, panels, toolbar, components)
  types.ts                   # Annotation types, tool union, shared types
  annotationPersistence.ts   # Load/save/sidecar/localStorage
  pdfExport.ts               # PDF export with flatten + attachment embedding
  rendering/
    drawAnnotations.ts       # Canvas annotation rendering
  viewer/
    controls.ts              # Zoom/page/fit control math
  engine/
    actions.ts, state.ts     # Reducer actions and state management
    history.ts               # Undo/redo stack
    hitTest.ts               # Point-in-annotation testing
    selection.ts             # Multi-select state
    transforms.ts            # Move, resize, rotate
    utils.ts                 # Shared utilities
  tools/                     # 18 tool implementations via ToolBehavior interface
  hooks/
    usePanelState.ts         # Panel visibility management
    useNavigationHistory.ts  # Page back/forward history
    useManagerInit.ts        # Plugin/storage/AI manager init
    useCommandRegistry.ts    # Command palette commands
    useVirtualScroll.ts      # Virtual scrolling for large docs
    useMemoizedAnnotations.ts
  components/
    Toolbar.tsx              # Icon-based grouped toolbar
    ToolIcon.tsx             # SVG icons for 18 tools
    PanelLayout.tsx          # 3-column grid shell
    LeftSidebar.tsx          # Sheets/Pages sidebar
    RightPanel.tsx           # 5-tab detail panel
    CommandPalette.tsx       # Fuzzy-search command palette
    (+ 15 more: TabBar, StatusBar, SelectionHandles, ShortcutHelpPanel,
     CommentsPanel, MarkupsList, StampPicker, ToolPresets,
     ScaleCalibrationPanel, SheetIndex, NavigationHistory, CompareView,
     ThreadedComments, PunchListPanel, PresenceIndicator, StorageBrowser,
     AIAssistPanel, VirtualPageList)
  workflow/                  # Tabs, stamps, comments, review, threading, punch lists
  pdf/                       # Text layer, search, sheet detection, comparison
  formats/                   # XFDF import/export
  collaboration/             # CRDT-ready sync model
  plugins/                   # Plugin API + 3 built-in plugins
  storage/                   # Storage abstraction + IndexedDB provider
  ai/                        # AI features (local heuristic provider)
  utils/                     # Fuzzy match, render optimizations, accessibility
```

## Keyboard Shortcuts
| Key | Action |
|-----|--------|
| V | Select | P | Pen | R | Rectangle | H | Highlight |
| T | Text | A | Arrow | C | Callout | K | Cloud |
| M | Measurement | G | Polygon | S | Stamp | E | Area |
| N | Angle | X | Count | D | Dimension | O | Ellipse |
| L | Polyline | Cmd+K | Command palette |
| Ctrl+Z / Ctrl+Shift+Z | Undo / Redo |
| Delete | Remove selected | [ / ] | Z-order |
| ? | Show shortcuts | Space (hold) | Pan |

## Known Limitations
- Bundle size is large due to pdf.js worker (~1.2MB)
- Selection handles are visual; full handle drag-resize is not fully wired yet
- Collaboration features are local-only (no WebSocket server yet)
- AI features use local heuristics (no cloud AI provider integrated yet)
