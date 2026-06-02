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
  img/                Logos, favicon, social/app icons (see "Icons & social" below).
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
disabled.

---

## Hosting it (static)

The site is plain static files. To host it anywhere (Netlify, Cloudflare Pages, S3,
Apache/Nginx, GitHub Pages…), publish these paths at the web root:

```
index.html  assets/  css/  js/  robots.txt  sitemap.xml  site.webmanifest  _headers
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
`CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` as GitHub repository secrets. **If you
don't want auto-deploy, delete that workflow file.**

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

- [ ] **Legal pages.** The footer links to `/privacy-policy/` and `/terms-of-service/`.
      Create those pages (or repoint the links). They are intentionally not written here.
- [ ] **Cloudflare account.** Set `CLOUDFLARE_ACCOUNT_ID` / `CLOUDFLARE_PROJECT` to your own
      account before deploying (see above). Nothing ships to anyone else's account.
- [ ] **Domain in metadata.** Canonical URL, Open Graph `og:url`/`og:image`, the JSON-LD
      `url`/`logo`, `robots.txt`, and `sitemap.xml` all use `wewatchyourwebsite.com`. Update
      them if the live domain differs.
- [ ] **Structured data.** `index.html` includes Organization + product JSON-LD with only
      verified facts. Add contact details (phone/email/address) to the Organization node if
      you want them in search results.
- [ ] **Optional CSP.** `_headers` ships conservative security headers. A
      Content-Security-Policy template is included but commented out — test it in a preview
      deploy before enabling (the page uses inline styles and Google Fonts).

---

## Ownership

This site was designed and built by WebPath Agency and is transferred to the client for
their unrestricted use. See [LICENSE](LICENSE).
