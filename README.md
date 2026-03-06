# KPDF

PDF viewer + professional AEC markup tool for local annotation workflows.

Access app live at: https://mjamiv.github.io/kpdf/

## Features

### Markup Tools (18 tools)
- **Basic**: Select, Pen (variable-width), Rectangle, Highlight, Text, Ellipse
- **Shapes**: Arrow, Callout, Cloud, Polygon, Polyline
- **AEC**: Measurement, Area, Angle, Count, Dimension
- **Other**: Stamp (with custom stamp library), Hyperlink (cross-page links)

### Terminal-Native UI
- **Layout**: Rounded window container on warm paper background, slim TopBar (40px) with traffic-light dots and terminal title, vertical ToolRail (46px), maximized canvas
- **Light terminal aesthetic**: Ink-on-paper color system with monospace-first typography (IBM Plex Mono + JetBrains Mono)
- **Design tokens**: `--kpdf-*` CSS custom properties in dedicated `src/theme.css` with WCAG AA contrast compliance
- **Tool rail**: Vertical sidebar with collapsible tool groups, ink-inversion active states, category-colored tool indicators
- **Left sidebar**: Unified "Document" view with collapsible Sheets and Pages sections
- **Right panel**: 3-tab interface — Activity (comments + punch list), Markups, AI Assist
- **Canvas**: Drop zone empty state with keyboard shortcut hints, drag overlay for PDF drop
- **Context menu**: Right-click on canvas for annotation actions (copy, paste, delete, z-order, deselect, quick tool switch)
- **Tooltips**: Delayed hover tooltips with keyboard shortcut badges on all TopBar and ToolRail buttons
- **Loading indicator**: Animated progress bar during PDF operations
- **Command palette**: Fuzzy-search commands via Cmd+K / Ctrl+K (includes migrated toolbar actions)
- **Status bar**: Shows active tool, locked state, and Cmd+K hint
- **Accessibility**: `prefers-reduced-motion` support, focus-visible indicators, no outline suppression
- **Responsive**: Compact tool rail at 980px, overlay sidebars at 768px

### Viewer Controls
- **Smooth zoom**: exponential curve zoom with CSS transform interpolation + debounced high-res re-render (0.1x-8x range)
- **High-sensitivity scroll zoom**: Ctrl/Cmd + wheel uses proportional exponential scaling — less scrolling, more zoom
- **Proportional trackpad zoom**: continuous zoom from trackpad pinch gestures
- **Pinch-to-zoom**: two-finger pinch and pan on touch devices
- **Zoom window**: draw a box to zoom into a specific area (`W` key or tool rail icon)
- **Inertial pan**: momentum-based panning with friction decay after release
- Keyboard zoom: **Ctrl/Cmd +**, **Ctrl/Cmd -**, **Ctrl/Cmd 0**
- Mouse zoom: **Ctrl/Cmd + wheel** (anchor-aware). Optional scroll-to-zoom mode (toggle via Cmd+K)
- Fit modes: **Fit Width**, **Fit Page**, plus fixed zoom presets
- Pan: toggle **Pan** mode (`H`), hold **Space**, or middle-click drag
- Page navigation with back/forward history breadcrumbs

### Tool Interaction Model
- Default behavior returns to **Select** after creating an annotation
- **Tool lock**: double-click or right-click a tool to lock it for repeated use (lock icon shown)
- **Lock via Cmd+K**: command palette offers "Tool: [Name] (Lock)" variants
- **Quick tool switching**: right-click canvas shows "Switch to..." menu for 5 common tools
- **All groups expanded** by default (collapse state persisted)
- **Escape key**: revert to Select tool, then deselect on second press
- Shift-key constraints (45° angles, squares, proportional resize)
- Tool presets for discipline-specific workflows (Electrical, Structural, Plumbing, etc.)
- Scale calibration for real-world measurement annotations
- **Custom cursors**: tool-specific SVG cursors (pen, stamp, cloud, measurement)

### Engine
- Reducer-based state with full undo/redo (200-deep, coalesced drag actions)
- Hit-testing for all annotation types (point-in-polygon, distance-to-segment)
- **Live drag preview**: annotations follow the cursor in real-time during move
- **Marquee selection**: drag on empty space to rubber-band select multiple annotations
- **Hover highlight**: annotations glow on hover with cursor feedback
- Selection system with multi-select (shift+click, marquee, Cmd+A), locked annotation filtering
- **Clipboard**: Copy (Cmd+C), Paste (Cmd+V), Duplicate (Cmd+D)
- **Arrow-key nudge**: 1px (or 10px with Shift) for precise positioning
- Transform operations: move, resize (with Shift-proportional), rotate, z-order
- **Resize handle hover states**: handles grow and glow on hover
- Snapping/alignment guides with visual guide lines during move/resize

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
  App.tsx                    # Main app shell
  App.css                    # Terminal theme (layout, panels, components)
  theme.css                  # --kpdf-* design tokens + bridge mappings
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
    usePanelState.ts         # Panel visibility (overlay state pattern)
    useNavigationHistory.ts  # Page back/forward history
    useManagerInit.ts        # Plugin/storage/AI manager init
    useCommandRegistry.ts    # Command palette commands (incl. migrated toolbar actions)
    useVirtualScroll.ts      # Virtual scrolling for large docs
    useMemoizedAnnotations.ts
  components/
    TopBar.tsx               # Slim 40px header (file, undo, zoom, page nav, panel toggles)
    ToolRail.tsx             # Vertical 46px tool sidebar (collapsible groups)
    ContextMenu.tsx          # Right-click context menu
    contextMenuItems.ts      # Context menu item builder
    Tooltip.tsx              # Hover tooltip with shortcut badges
    ToolIcon.tsx             # SVG icons for 18 tools
    PanelLayout.tsx          # 4-column grid shell (rail + sidebar + canvas + panel)
    LeftSidebar.tsx          # Collapsible Sheets/Pages sidebar
    RightPanel.tsx           # 3-tab panel (Activity/Markups/AI)
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
| L | Polyline | U | Hyperlink |
| Cmd+K | Command palette | Cmd+A | Select all |
| Cmd+C / V / D | Copy / Paste / Duplicate |
| Ctrl+Z / Ctrl+Shift+Z | Undo / Redo |
| Arrows | Nudge (Shift = 10x) | Esc | Tool->Select / Deselect |
| Delete | Remove selected | [ / ] | Z-order |
| W | Zoom window | ? | Show shortcuts |
| Space (hold) | Pan |

## Known Limitations
- Bundle size is large due to pdf.js worker (~1.2MB)
- Collaboration features are local-only (no WebSocket server yet)
- AI features use local heuristics (no cloud AI provider integrated yet)
