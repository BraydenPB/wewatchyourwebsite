# WeWatchYourWebsite — Landing Page

A fast, dependency-light static landing page for WeWatchYourWebsite. One HTML file,
one stylesheet, and a handful of small vanilla-JS modules that drive the canvas/WebGL
"security console" visuals. No build framework, no runtime backend — it serves as flat
files and deploys to any static host.

---

## Quick start

Requires [Node.js](https://nodejs.org/) 18+ (CI uses 24). No `npm install` is needed to
run locally — the dev server uses only Node's standard library.

```bash
npm run dev      # serve at http://localhost:8098
```

Then open <http://localhost:8098>. Edit files and refresh — there is no hot-reload.

---

## Project structure

```
index.html            The entire page (semantic HTML; inline brand SVG sprite).
css/styles.css        All styles. Mobile-first, CSS custom-property design tokens.
js/
  main.js             Orchestration: mobile menu, scan console, scroll-reveal.
  letter-glitch.js    Decorative animated text backdrops (2D canvas).
  scan-radar.js       Rotating radar sweep (2D canvas).
  defense-field.js    "We work one layer below" defense visual (2D canvas).
  faulty-terminal.js  CRT terminal backdrop (WebGL shader).
  netops.js           Hero network-defense waveform monitor.
  pipeline.js         Code-analyzer inspect/scan animation.
  vendor/lottie.min.js  Self-hosted lottie-web 5.12.2 (the 4 scan-pass animations).
assets/
  img/                Brand logos, favicon (SVG), apple-touch + PWA icons, OG share image.
  fonts/              Self-hosted variable woff2 (Space Grotesk, Inter, JetBrains Mono).
  lottie/             Lottie JSON animations for the WordPress scan console.
robots.txt            Allows all crawlers; points at the sitemap.
sitemap.xml           Single-page sitemap.
site.webmanifest      PWA manifest (name, theme color, app icons).
_headers              Cloudflare Pages security/cache headers.
serve.js              Minimal local dev server.
deploy.js             Allowlist-based build + Cloudflare Pages deploy.
```

### Accessibility & motion

The page is built to WCAG-friendly standards: a skip link, a focus-trapped modal mobile
menu (Escape closes, focus returns), descriptive `aria-label`s, and full
`prefers-reduced-motion` support — every animated module paints a single static frame
when the visitor prefers reduced motion, and the page is fully readable with JavaScript
disabled. For visitors who haven't set the OS motion preference, a **"Pause animations"**
control in the footer freezes all ambient motion in place (WCAG 2.2.2), and resumes it.

---

## Hosting it (static)

The site is plain static files. To host it anywhere (Netlify, Cloudflare Pages, S3,
Apache/Nginx, GitHub Pages…), publish these paths at the web root:

```
index.html  assets/  css/  js/  privacy-policy/  terms-of-service/
robots.txt  sitemap.xml  site.webmanifest  _headers
```

`_headers` is a [Cloudflare Pages](https://developers.cloudflare.com/pages/configuration/headers/)
convention. On other hosts, translate those rules into that host's header config (or drop
the file — the site works without it).

### Deploying to Cloudflare Pages (optional tooling)

`deploy.js` assembles a clean `dist/` from an **allowlist** (so private files such as
`memory/` can never be published) and pushes it with Wrangler. It is wired to **your own**
Cloudflare account via environment variables — there are no hardcoded credentials.

```bash
# one-time: install Wrangler and log in
npm install -g wrangler
wrangler login

# set your account + project, then:
export CLOUDFLARE_ACCOUNT_ID=your_account_id
export CLOUDFLARE_PROJECT=your_pages_project   # defaults to "wwyw2"
npm run build      # assemble dist/ only (inspect before shipping)
npm run deploy     # assemble dist/ AND deploy to Cloudflare Pages
```

`.github/workflows/deploy.yml` auto-deploys on push to `main`. To use it, add
`CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` as GitHub repository **secrets**.
The workflow deploys to a Pages project named `wwyw2` by default; to target a
differently-named project, add a `CLOUDFLARE_PROJECT` repository **variable** (it's
non-sensitive, so a variable rather than a secret). **If you don't want auto-deploy,
delete that workflow file.**

---

## Porting it into WordPress

The markup is framework-agnostic and templating-friendly:

- All asset paths are root-relative (`css/…`, `js/…`, `assets/…`). When porting to a theme,
  prefix them with the theme URI (e.g. `get_template_directory_uri()`), or keep the assets
  at the site root.
- The brand logo is an inline SVG `<symbol>` sprite (top of `index.html`) referenced via
  `<use>` — copy the sprite block into `header.php` once and reuse it.
- The JS modules are self-contained and mount onto `data-*` attributes
  (`data-glitch`, `data-console`, `data-netops`, …). Keep those attributes on the
  corresponding elements and the visuals keep working — no inline scripts to untangle.
- The FAQ uses native `<details>`/`<summary>` — no JS dependency.

---

## Before you launch — checklist

- [ ] **Legal pages.** `privacy-policy/` and `terms-of-service/` ship as honest
      "being finalized" placeholders (marked `noindex`) so the footer links resolve instead
      of 404ing. Replace their contents with your real Privacy Policy and Terms before
      launch — the legal text is intentionally not written for you.
- [ ] **Cloudflare account.** Set `CLOUDFLARE_ACCOUNT_ID` / `CLOUDFLARE_PROJECT` to your own
      account before deploying (see above). Nothing ships to anyone else's account.
- [ ] **Domain in metadata.** Canonical URL, Open Graph `og:url`/`og:image`, the JSON-LD
      `url`/`logo`, `robots.txt`, and `sitemap.xml` all use `wewatchyourwebsite.com`. Update
      them if the live domain differs.
- [ ] **Structured data.** `index.html` includes Organization + product JSON-LD with only
      verified facts. Add contact details (phone/email/address) to the Organization node if
      you want them in search results.
- [ ] **Optional CSP.** `_headers` ships conservative security headers (including
      `Cross-Origin-Opener-Policy`). A Content-Security-Policy template is included but
      commented out — test it in a preview deploy before enabling. Fonts are self-hosted,
      so the template needs only `'unsafe-inline'` in `style-src` (for the inline wordmark
      `<style>` and `style="--i:.."` attributes) and `font-src 'self'`.

---

## Ownership

This site was designed and built by WebPath Agency and is transferred to the client for
their unrestricted use. See [LICENSE](LICENSE).
