# KPDF

Minimal PDF viewer + markup tool focused on smooth local workflows.

## What it does now
- Open and view PDF files with page navigation and zoom.
- Markup tools: `Pen`, `Rectangle`, `Highlight`, `Text`.
- Undo and clear-page actions.
- Save modes:
  - **Editable PDF**: embeds annotation payload as PDF attachment when payload size is under threshold.
  - **Flattened PDF**: burns markup into page content.
- Always exports sidecar JSON (`.kpdf.json`) for portability/recovery.
- Autosaves annotations in local storage by PDF fingerprint.
- Loads annotations from:
  1. Embedded PDF attachment (`kpdf-annotations-v2.json`)
  2. Legacy keywords metadata payload (backward compatibility)
  3. Local autosave fallback

## Stack
- React + TypeScript + Vite
- `pdfjs-dist` for rendering
- `pdf-lib` for export + PDF attachment embedding
- `vitest` for unit tests

## Run
```bash
cd /Users/mjamiv/coding/kpdf
npm install
npm run dev
```
Open the Vite URL (usually `http://localhost:5173`).

## Quality checks
```bash
npm run test
npm run lint
npm run build
```

## Key files
- App/UI flow: `src/App.tsx`
- Annotation model: `src/types.ts`
- Persistence v2: `src/annotationPersistence.ts`
- PDF export: `src/pdfExport.ts`
- Agent execution plan for Phase 2/3: `docs/PHASE2_3_AGENT_PLAN.md`

## Current limitations
- No post-placement selection/move/resize yet.
- Highlight is box-based; true text-layer highlight not implemented yet.
- Bundle size is large due to pdf.js worker.

## Planned next milestone
Phase 2 foundation: selection/transform engine + robust undo/redo + test harness.
