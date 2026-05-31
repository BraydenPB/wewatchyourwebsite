---
name: wwyw2-design-direction
description: Locked design direction for the wewatchyourwebsite.com (wwyw2) rebuild
metadata:
  type: project
---

Building **wewatchyourwebsite.com** (project dir `wwyw2`) as a clean static site (semantic HTML + shared CSS/JS, deploy target Cloudflare Pages). Goal set 2026-05-30.

**Design formula: WWYW brand palette × Cloudflare structural vibe × lime-themed LetterGlitch accents.** Brief says "similar (NOT same)" to the May 2026 Cloudflare redesign — a low-precision target, so borrow STRUCTURE, not Cloudflare's palette.

**Brand palette (from logo SVG `assets/img/*.svg`, ground truth):**
- Lime/chartreuse `#69ff12` (primary accent — the shield scanline glyph)
- Green radial gradient `#bed143` → `#3d6f3c`
- Navy/near-black shield `#000033` / `#0c0c0c`
- Wordmark reads "WEWATCHYOURWEBSITE". Security/monitoring brand (shield + scanline aesthetic).

**Cloudflare vibe = structure not color:** generous whitespace, big confident type, clean sectioning, CSS-based minimalism (no heavy drop-shadow/noise images — crisp gradients), modular lock-together components, responsive grid, custom icon system, restrained motion. (Source: blog.cloudflare.com/redesigning-cloudflare)

**LetterGlitch** (reactbits, full source ported to VANILLA canvas — no React in a static site): re-theme default greens to lime/teal brand. Use as TASTEFUL ACCENT (hero backdrop, section dividers, footer) in low-text zones only with vignette on — NOT literally behind body text everywhere (kills readability, fights clean vibe).

**Assets:** 4 Lottie animations (~600×400 @60fps) = the 4 service pillars: file-integrity, malware-removal, root-cause-determination, total-protection. Lottie requires HTTP to load (CORS) — `npm run dev` serves on port 8098.

**Anti-drift workflow** (wwyw history: 3 prior attempts failed by drifting design): 1) synthesize design system, 2) build ONE homepage to high bar emitting shared files (tokens CSS, LetterGlitch module, header/footer), LOCK it, 3) THEN fan out remaining pages off locked CSS/components, 4) cross-page consistency review. Homepage-first is the anti-drift anchor.

**STATUS (commit f65c5e4):** Landing page BUILT — `index.html` (7 sections: hero, proof ribbon, 2x2 services grid w/ Lottie, how-it-works, stats, pricing teaser, FAQ, final CTA), `css/styles.css` (locked design tokens), `js/letter-glitch.js` (vanilla port), `js/main.js`. CTA decided: primary "Protect My Site", secondary "Run a Free Scan". 4-lens adversarial review ran; all 21 findings fixed (hero/footer/CTA scrim AA contrast, FAQ focus ring, forced-colors mode, mobile-menu inert focus containment, perf reflow, teal two-accent, etc). All assets serve HTTP 200, JS syntax-checks pass.

**VISUAL PASS DONE (via Chrome MCP, this session):** Verified live at http://localhost:8098 at 1440px + 390px. Hero/final-CTA/footer = glitch reads as signature texture AND text is crisp (scrim balance correct, NOT buried). Services Lottie animations render. Mobile responsive (hamburger, stacked CTAs, reflow) is clean. ZERO console errors.

**Logo FIXED:** the original metal-gradient/multiply shield read as a muddy grey blob on dark. Replaced the `#wwyw-wordmark` <symbol> in index.html with a purpose-built REVERSED dark-surface logo: `assets/img/wordmark-reversed.svg` — simplified dark shield + lime hairline + lime radial core + lime scanline glyph + light wordmark text. Reads crisply at 32px header + footer. Also added `assets/img/favicon.svg` (lime shield) — killed the favicon 404.

**Known follow-ups (deferred, non-blocking):** export a 1200x630 raster OG/social share image (SVG OG won't render on social); wire Privacy/Terms placeholder links + real signup/scan CTA URLs when backend ready; consider self-hosting lottie.min.js + fonts for Cloudflare Pages. Then: build remaining multipage site pages off this LOCKED anchor.
