# Phase 2 & 3 Agent Assembly Plan

## Mission
Deliver Phase 2 (Pro Markup UX) and Phase 3 (Document Workflows) with production-grade reliability, while preserving Phase 1 persistence guarantees.

## Team (5 agents)

### 1) Annotation Engine Agent (Core)
- Focus: object selection, hit-testing, transform handles, z-order ops, undo/redo engine.
- Decision lens: correctness over speed; deterministic state transitions.
- Owns:
  - `src/engine/annotationModel.ts`
  - `src/engine/history.ts`
  - `src/engine/hitTest.ts`
- Outputs:
  - Selection/move/resize/rotate for all current annotation types.
  - 100-operation undo/redo with action coalescing for drag operations.
  - Locked-annotation enforcement in all mutating paths.

### 2) PDF Text + Search Agent
- Focus: real text highlight, text search, and text-layer coordinate mapping.
- Decision lens: geometric fidelity to page transform and zoom state.
- Owns:
  - `src/pdf/textLayer.ts`
  - `src/pdf/searchIndex.ts`
- Outputs:
  - True text-highlight annotation mode (not rectangular fake highlight).
  - Search panel with next/prev match and page jump.
  - Mapping tests on rotated/scaled pages.

### 3) Tooling UX Agent
- Focus: advanced tools and usability speed.
- Decision lens: minimum clicks for common workflows.
- Owns:
  - `src/tools/*`
  - toolbar/hotkey map in `src/App.tsx` split to modular components.
- Outputs:
  - Arrow, callout, cloud, measurement line, area polygon.
  - Snap guides and alignment hints.
  - Shortcut system with discoverable cheat sheet.

### 4) Workflow Agent (Phase 3)
- Focus: multi-doc tabs, stamps, comments/review panel, report exports.
- Decision lens: review throughput and traceability.
- Owns:
  - `src/workflow/tabs.ts`
  - `src/workflow/comments.ts`
  - `src/workflow/stamps.ts`
  - `src/workflow/reports.ts`
- Outputs:
  - Multi-document tab state with unsaved-change guard.
  - Stamp library with date/user templates.
  - Comment list panel (filter + click-to-jump).
  - Markup summary export (CSV + PDF summary).

### 5) Quality + Performance Agent
- Focus: integration tests, perf budgets, regression gates.
- Decision lens: block merges that violate budgets.
- Owns:
  - `tests/unit/*`
  - `tests/e2e/*`
  - perf harness scripts.
- Outputs:
  - Playwright happy-path and regression suites.
  - Golden roundtrip tests (open -> annotate -> save -> reopen -> edit).
  - Budget checks: first-page render < 400ms (10MB baseline), interaction >= 50 FPS.

## Shared context all agents must honor
- Annotation persistence v2 is the source of truth.
- Editable save must embed attachment when under threshold; sidecar fallback remains mandatory.
- Flattened save must not carry editable payload.
- Coordinate system remains normalized page space to avoid zoom drift.

## Parallel execution tracks

### Track A (Engine foundation)
- Annotation Engine Agent + Quality Agent.
- Scope:
  - Selection model, transforms, undo/redo core.
  - Unit tests for transform math and history behavior.
- Duration: Week 1-2.
- Exit criteria:
  - All existing tools become selectable and mutable.
  - Undo/redo deterministic across 1,000 random action fuzz test.

### Track B (Text fidelity)
- PDF Text + Search Agent + Quality Agent.
- Scope:
  - Text-layer extraction and mapping.
  - True text highlight.
  - Search navigation.
- Duration: Week 1-3.
- Exit criteria:
  - Highlight boxes align within 2px at 100-300% zoom.
  - Search results stable across reopen/save cycles.

### Track C (UX + Workflow)
- Tooling UX Agent + Workflow Agent.
- Scope:
  - Advanced tools.
  - Tabs, stamps, comments panel, report exports.
- Duration: Week 2-4.
- Exit criteria:
  - Keyboard-first annotation flow works end-to-end.
  - Comment click-to-jump and export reports verified.

## Integration cadence
- Daily: 20-minute cross-agent integration sync (interface contracts only).
- Twice weekly: trunk integration window with Quality Agent gate.
- Weekly milestone branch cut:
  - End Week 1: selection + undo backbone merged.
  - End Week 2: advanced tools alpha + tabs alpha.
  - End Week 3: true text highlight + comments panel beta.
  - End Week 4: Phase 2/3 release candidate.

## Risk register and forced decisions
1. Risk: text-layer mapping inconsistency across PDFs.
- Decision: ship with confidence score per page; auto-fallback to rectangle highlight on low-confidence pages.

2. Risk: perf collapse on large drawings with dense markup.
- Decision: enforce viewport culling + throttled redraw before adding any new tool variant.

3. Risk: state complexity from tabs + undo.
- Decision: per-document isolated store; no shared mutable singleton state.

## Definition of done (Phase 2 & 3)
1. Functional
- All Phase 2 and 3 features implemented from roadmap.
- No data loss across save/reopen cycles in editable mode.

2. Quality
- Unit: >= 90% coverage on engine/state modules.
- E2E: green on critical flows.
- Perf budgets pass on baseline machine profile.

3. Release artifacts
- Updated runbook with shortcuts and workflows.
- Migration notes for persistence behavior.
- Known limitations document.

## First 72-hour action queue
1. Annotation Engine Agent
- Implement object selection model + transform handles.
- Add immutable action log reducer with inverse ops.

2. PDF Text + Search Agent
- Build text-item extraction and bbox normalization POC.
- Create mapping fixtures from 3 representative PDFs.

3. Tooling UX Agent
- Split monolithic toolbar into modular tool registry.
- Wire hotkey dispatcher and conflict map.

4. Workflow Agent
- Build tab state manager with unsaved badge and close guard.
- Define comment entity schema and page anchor model.

5. Quality + Performance Agent
- Stand up Playwright scaffolding and perf harness baseline.
- Add CI gates for test/lint/build + perf smoke.
