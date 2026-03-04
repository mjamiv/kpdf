# MEMORY

## Completed this session
- Bootstrapped project from empty directory into React/Vite TypeScript app.
- Implemented MVP PDF viewer + markup workflow:
  - Open/drop PDF
  - Render with pdf.js
  - Markup tools (pen/rectangle/highlight/text)
  - Zoom/page navigation
  - Undo/clear page
- Added PDF export pipeline with flatten support.
- Added annotation schema v2 with metadata fields (`zIndex`, `author`, timestamps, `locked`).
- Implemented persistence system:
  - Sidecar JSON export/import
  - localStorage autosave by document fingerprint
  - Embedded payload in PDF attachment (`kpdf-annotations-v2.json`) when size under threshold
  - Automatic sidecar-only fallback when payload exceeds threshold
  - Legacy keyword payload read compatibility
- Added tests:
  - `src/pdfExport.test.ts`
  - `src/annotationPersistence.test.ts`
- Produced Phase 2/3 team execution plan in `docs/PHASE2_3_AGENT_PLAN.md`.

## Key decisions and tradeoffs
- Chose normalized page coordinates for annotations to keep zoom/pan rendering stable.
- Chose attachment embedding over metadata keywords for robustness.
- Kept keyword decoding only for backward compatibility with earlier saved files.
- Editable and flattened save are explicit modes; flattened mode skips editable embedding.
- Sidecar export is always generated to avoid data loss and simplify recovery.

## Current state
- App builds/tests/lints clean.
- Persistence architecture is in place for next-phase features.
- Repository directory is currently **not** a git repository (`.git` missing), so git-based wrap-up steps cannot run.

## Outstanding risks
- Repeated editable saves may accumulate stale attachments depending on `pdf-lib` attachment handling.
- Large PDFs with dense markups may hit payload threshold and rely on sidecar-only persistence.
- No diagnostics UI yet to make persistence mode visible per save/load operation.

## Next steps
1. Implement Phase 2 item 1: selection/hit-test/transform handles.
2. Implement undo/redo reducer with coalesced drag actions.
3. Modularize `src/App.tsx` into engine/tools/workflow/components folders.
4. Add Playwright e2e harness for open -> annotate -> save -> reopen flows.
