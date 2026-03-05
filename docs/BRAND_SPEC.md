# KPDF Brand Specification

Version: 1.0  
Date: 2026-03-05  
Owner: Product + Design + Frontend

## 1. Brand Outcome

KPDF should feel like a **modernized desktop terminal for serious technical work**: calm, precise, lightweight, and no visual noise.

The attached references define the direction:
- Minimal monochrome terminal UI
- Rounded desktop window shell
- Monospace-first typography
- Subtle “workbench” background (warm paper tone or dark focus field)
- Iconography centered on prompt language (`>_`)

## 2. Brand Pillars

1. **Operational Clarity**: Information first, chrome second.
2. **Technical Credibility**: Monospace, tabular numbers, strict alignment.
3. **Quiet Confidence**: Low-saturation palette, restrained accents.
4. **Desktop Familiarity**: Terminal-window metaphors, not web-app tropes.

## 3. Visual Direction (Source-Derived)

### 3.1 Core Shape Language
- Use rounded window containers (`16px-20px` radius) with thin dark frames.
- Prefer rectangular primitives with soft corners (`6px-10px`) for controls.
- Keep icon strokes geometric and consistent (`2px` at 24x24 grid).

### 3.2 Tonal Model
- Default UI is **light terminal surface** on subtle background.
- Optional focus mode uses dark backdrop behind one or more floating terminal windows.
- Avoid saturated gradients, glassmorphism, and neon accents.

### 3.3 Brand Motif
- Primary symbol: rounded rectangle terminal with `>_`.
- Prompt caret and underscore become recurring micro-motifs (empty states, loaders, shortcuts).

## 4. Design Tokens (Implementation Source of Truth)

## 4.1 Color Tokens

```css
:root {
  /* Base ink + papers */
  --kpdf-ink-strong: #111317;
  --kpdf-ink: #1d2128;
  --kpdf-ink-muted: #555e6b;
  --kpdf-paper: #ececec;
  --kpdf-paper-warm: #e8dacd;
  --kpdf-paper-elevated: #f5f5f5;

  /* Window/chrome */
  --kpdf-chrome: #d7d7d9;
  --kpdf-frame: #20233a;
  --kpdf-border: #b9bcc2;
  --kpdf-border-strong: #7a7f88;

  /* Functional accents */
  --kpdf-success: #49a35d;
  --kpdf-warning: #d1b041;
  --kpdf-danger: #c8574f;
  --kpdf-info: #3f6ea8;

  /* Traffic lights */
  --kpdf-dot-red: #de5a52;
  --kpdf-dot-yellow: #e1c44a;
  --kpdf-dot-green: #5ac251;

  /* Backdrops */
  --kpdf-backdrop-dark: #101217;
  --kpdf-backdrop-vignette: rgba(7, 9, 13, 0.78);

  /* Shadows */
  --kpdf-shadow-window: 0 18px 45px rgba(0, 0, 0, 0.26);
  --kpdf-shadow-soft: 0 8px 22px rgba(0, 0, 0, 0.16);
}
```

### 4.2 Typography Tokens

```css
:root {
  --kpdf-font-ui: "IBM Plex Mono", "JetBrains Mono", "SFMono-Regular", Menlo, monospace;
  --kpdf-font-display: "IBM Plex Mono", "JetBrains Mono", "SFMono-Regular", Menlo, monospace;

  --kpdf-text-12: 12px;
  --kpdf-text-13: 13px;
  --kpdf-text-14: 14px;
  --kpdf-text-16: 16px;
  --kpdf-text-20: 20px;

  --kpdf-leading-tight: 1.2;
  --kpdf-leading-base: 1.45;
  --kpdf-tracking-tight: -0.01em;
}
```

Rules:
- Use monospace for all navigation, controls, measurements, and tabular data.
- Use tabular numerals everywhere numbers update live.
- Uppercase labels are allowed only for compact chrome headings.

### 4.3 Spacing, Radius, Stroke

```css
:root {
  --kpdf-space-2: 2px;
  --kpdf-space-4: 4px;
  --kpdf-space-8: 8px;
  --kpdf-space-12: 12px;
  --kpdf-space-16: 16px;
  --kpdf-space-24: 24px;
  --kpdf-space-32: 32px;

  --kpdf-radius-control: 6px;
  --kpdf-radius-panel: 10px;
  --kpdf-radius-window: 18px;

  --kpdf-stroke-1: 1px;
  --kpdf-stroke-2: 2px;
}
```

## 5. Component Brand Spec

### 5.1 App Shell
- Background default: `--kpdf-paper-warm`.
- Main work surface: centered window frame with `--kpdf-radius-window`.
- Window shell includes thin dark outline (`1px-2px`) and `--kpdf-shadow-window`.

### 5.2 Top Bar (Terminal Chrome)
- Height: `40px`.
- Background: `--kpdf-chrome`.
- Left traffic-light dots, center title in semibold monospace.
- Format for title: `{workspace}@{machine} — 80 x 24`.

### 5.3 Tool Rail and Panels
- Replace heavy dark blocks with light panels (`--kpdf-paper` / `--kpdf-paper-elevated`).
- Active tool uses ink inversion or subtle border emphasis, not saturated fill.
- Section separators are 1px neutral lines (`--kpdf-border`).

### 5.4 Canvas and Content Panels
- Canvas should read as a clean terminal viewport: high contrast black text on light background.
- Data rows (markups/comments) mimic terminal list rhythm: compact vertical spacing, no card clutter.
- Keep success state green aligned to test output reference image.

### 5.5 Buttons and Inputs
- Default: paper background, 1px neutral border, monospace label.
- Hover: 3-5% darken.
- Focus ring: 2px solid `--kpdf-info`.
- Destructive actions use text + border tint, not solid red blocks.

## 6. Iconography & Logo

### 6.1 Primary App Mark
- Rounded terminal rectangle enclosing `>_`.
- Stroke-only variant on light backgrounds.
- Filled dark variant on light backgrounds when size < 24px.

### 6.2 Icon Rules
- 24x24 grid, 2px stroke, rounded caps/joins.
- Prefer literal technical metaphors (cursor, ruler, angle, area hatch).
- No decorative gradients, no playful glyph exaggeration.

## 7. Motion and Interaction

- Motion profile: short, functional, and sparse.
- Standard duration: `120ms-180ms`; panel transitions max `220ms`.
- Easing: `cubic-bezier(0.2, 0.8, 0.2, 1)`.
- Use transitions for context shifts only (panel open/close, command palette, toasts).
- Respect reduced motion (`prefers-reduced-motion`) by disabling non-essential transitions.

## 8. Voice & Microcopy

Tone:
- Direct, technical, compact.
- Command-like phrasing over marketing language.

Patterns:
- Use verbs first: `Run export`, `Open markup report`, `Resolve thread`.
- Empty states use actionable prompts: `Drop a PDF to begin` / `Press Cmd+K to run commands`.
- Status messaging format: `<state>: <what happened>` (example: `Saved: sidecar written`).

## 9. Accessibility and Quality Gates

Non-negotiable checks:
1. Minimum text contrast ratio 4.5:1 for body text.
2. Focus indicators visible on every interactive control.
3. Keyboard traversal complete for all top-level workflows.
4. Monospace numerics remain tabular in status/readout controls.
5. Color is never the only status channel (include icon/text labels).

## 10. Implementation Plan (Team Rollout)

### Phase 1: Token Layer
- Introduce `--kpdf-*` tokens in a dedicated theme file.
- Map existing Forge tokens to new tokens to avoid broad regressions.

### Phase 2: Shell + Chrome
- Reskin TopBar, app frame, and panel surfaces first.
- Land traffic-light/title treatment and window framing.

### Phase 3: Controls + States
- Update buttons, inputs, tool states, and status colors.
- Standardize icon stroke weights and active/hover behavior.

### Phase 4: QA + Final Polish
- Contrast audit, visual regression snapshots, keyboard pass.
- Cross-check desktop + tablet widths before release.

## 11. Acceptance Criteria

1. Product screenshots clearly read as “terminal-native” in under 2 seconds.
2. UI remains legible and calm under dense markup/project data.
3. Brand can be implemented by frontend using tokens only (no one-off hardcoded colors).
4. New theme introduces no accessibility regressions from current build.

## 12. Explicit Non-Goals

- Not retro skeuomorphism.
- Not neon hacker aesthetic.
- Not heavy dark-only UI.
- Not consumer/friendly rounded pastel style.
