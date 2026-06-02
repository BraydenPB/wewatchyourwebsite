<!-- Keep in sync with CLAUDE.md — Codex reads AGENTS.md, Claude Code reads CLAUDE.md. -->
# WeWatchYourWebsite — landing page

Single-page static marketing site. **Framework-free, no build step**: one `index.html`, one `css/styles.css`, a handful of vanilla-JS modules in `js/`. Ships as flat files to any static host (Cloudflare Pages). Goal: stay Lighthouse 100/100/100/100 (desktop + mobile), zero console errors, no runtime dependencies.

## Commands
- `npm run dev` — dev server at http://localhost:8098 (Node stdlib only, no `npm install`). Loopback-only; refuses dotfiles + `memory/`.
- `npm run build` — assemble `dist/` from the **allowlist** in `deploy.js` (`PUBLISH`). Inspect before shipping; `dist/` is gitignored.
- `npm run deploy` — build + push to Cloudflare Pages (needs `CLOUDFLARE_ACCOUNT_ID` / `CLOUDFLARE_PROJECT` env).
- Node 18+ (CI: 24).

## Architecture
- `index.html` — the whole page; inline brand-SVG `<symbol>` sprite at top.
- `css/styles.css` — all styles. Mobile-first. **CSS custom-property design tokens are the locked anchor — consume, never redefine inline.** No literal colors in components.
- `js/*.js` — self-contained ES5 IIFE/prototype modules that mount on `data-*` hooks (`data-glitch`, `data-console`, `data-netops`, `data-scan-radar`…). All loaded with `defer`. `js/vendor/lottie.min.js` is self-hosted (no CDN).
- Fonts are self-hosted first-party in `assets/fonts/` (no Google Fonts CDN).

## Invariants — DO NOT break (each fixed a real bug; "modernizing" them regresses)
- **ES5 style is deliberate** (no-build: `var`, `function`, IIFE). Don't convert to modules/`const`/arrow/bundler unless fixing a concrete bug.
- **`.site-header` is a FIXED 64px height** — its `backdrop-filter` is a containing block for the mobile menu's fixed children. Don't make it auto/dynamic.
- **Mobile-menu constants are synced across CSS+JS**: 64px header anchor, 768px breakpoint, `--dur-slow` 260ms vs 300/320ms JS timeouts. Change one → change all.
- **Animations use NO `Math.random`** where determinism is required (netops waveform is sines + a fixed spike schedule; no-JS frame is seeded inline via `buildPaths(66)`, rate 138 — re-seed the markup if that math changes).
- **SVG gradient stops live in CSS** (`.netops__wave-stop--*`), not as `var()` presentation attributes (`var()` is unreliable in SVG presentation attrs across engines).
- **Fonts**: keep the metrics-matched `"… Fallback"` `@font-face` (local Arial + size/ascent/descent overrides) in each stack — they hold CLS through the swap. **JetBrains Mono is split into two disjoint weight bands (400–500 and 700) on purpose**, leaving a gap at 600 so the design's `font-weight:600` mono labels round up to the real 700 (as the old discrete Google faces did). A single `400 700` range renders a lighter true-600 — a regression.
- `!important` uses are specificity-necessary (lottie inline styles, reduced-motion + paused-motion overrides). Not defects.
- Decorative canvases are `aria-hidden`; real numbers live in the stat bands. Don't make the panels load-bearing.

## Motion / a11y contracts
- Every animated module paints ONE static frame and stops under `prefers-reduced-motion`; the page is fully readable with JS disabled.
- Global **"Pause animations"** footer control (WCAG 2.2.2): toggles `documentElement[data-motion="paused"]` + dispatches a `wwyw:motion` CustomEvent. Every animation owner folds a runtime `motionPaused` flag into its `play()`/`start()` gate and re-checks on-screen + tab-visible on resume (never blind-start off-screen). Keep new ambient motion wired into this.
- Mobile menu: focus-trapped `role="dialog"`, Escape/scrim close + focus return, `main`/`footer` inert while open. Don't loosen.

## Verification workflow (required before claiming done)
- **Lighthouse is blind to most changes here** — verify each by its own oracle, not a passing score:
  - Behavior (animation pause/resume, menu focus) → drive it in Chrome DevTools MCP and assert.
  - `_headers` (COOP, CSP, cache) → the dev server ignores `_headers`; only verifiable on a Cloudflare **preview deploy**.
  - Fonts/CLS → performance trace (CLS varies run-to-run; baseline ~0.01).
- Then re-run Lighthouse desktop + mobile (target 100×4) and confirm a clean console.
- Regenerate `dist/` (`npm run build`) before any merge; confirm no leaks (the build asserts `FORBIDDEN` paths stay out).

## Do NOT "fix" these — they are the CLIENT'S OWN published facts
- "18 years", "since 2007", "8M+ sites cleaned", "$59.95/yr", "eight-stage", "no per-clean fees". The "18 years since 2007" framing is intentional; leave it.
- `app.example.com` in the analyzer is intentional fake-vulnerable demo code.
- Legal pages (`privacy-policy/`, `terms-of-service/`) are honest `noindex` placeholders for the client to fill. The CSP in `_headers` is intentionally commented (test on a preview deploy). Domain in metadata is the client's to confirm. See README "Before you launch".

## Conventions (project-specific — see also global config)
- **No AI attribution** anywhere (no `Co-Authored-By`, no "Generated with…" footer) — commits, PRs, or any output.
- `main` auto-deploys to Cloudflare Pages on push — never push WIP to `main`; work on a `feat/*` or `fix/*` branch.
- Third-party licenses travel with their files: lottie (MIT), fonts (`assets/fonts/OFL.txt`, SIL OFL 1.1). See root `LICENSE`.
