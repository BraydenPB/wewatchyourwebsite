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
index.html            The home page (semantic HTML; inline brand SVG sprite).
scanner/index.html    The interactive Code Analyzer page (/scanner/). Shares the
                      home page's chrome and the same eight-stage inspect window;
                      adds a real submit form that drives a live scan. Demo mode
                      today — see "Wiring the analyzer to a real backend" below.
css/styles.css        All styles. Mobile-first, CSS custom-property design tokens.
js/
  main.js             Orchestration: mobile menu, scan console, scroll-reveal.
  letter-glitch.js    Decorative animated text backdrops (2D canvas).
  scan-radar.js       Rotating radar sweep (2D canvas).
  defense-field.js    "We work one layer below" defense visual (2D canvas).
  faulty-terminal.js  CRT terminal backdrop (WebGL shader).
  netops.js           Hero network-defense waveform monitor.
  pipeline.js         Code-analyzer inspect/scan animation (auto-run on scroll).
  analyzer-scan.js    Interactive scanner driver for /scanner/ (form → live run →
                      report). Contains the single backend seam (requestScan).
  vendor/lottie.min.js  Self-hosted lottie-web 5.12.2 (the 4 scan-pass animations).
assets/
  img/                Brand logos, favicon (SVG), apple-touch + PWA icons, OG share image.
  fonts/              Self-hosted variable woff2 (Space Grotesk, Inter, JetBrains Mono).
  lottie/             Lottie JSON animations for the WordPress scan console.
brand/                Master logo files (.ai/.eps/.psd/.pdf/.png/.jpg, vertical + horizontal).
                      Editable source artwork for print/design — NOT used by or published to
                      the website. See brand/README.md.
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
index.html  scanner/  assets/  css/  js/  privacy-policy/  terms-of-service/
robots.txt  sitemap.xml  site.webmanifest  _headers
```

Do **not** publish `brand/` — those are master design files, not web assets (`npm run build`
already excludes them; only host them yourself if you bypass the build).

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

## Wiring the analyzer to a real backend

The `/scanner/` page (`scanner/index.html`) is a **functional template**. The findings list,
the severity summary, the eight stage results, the verdict, the window's filename, and
(optionally) the source shown in the code panel all render from a single `ScanResult` object.
Today that object comes from a deterministic **demo dataset**: no backend is called and nothing
the visitor types ever leaves the browser.

> **Code-preview pane:** today it shows a fixed, nicely token-highlighted sample file. The
> `ScanResult` has an **optional `code` field** — when your API returns it (the fetched source
> plus which lines are findings), the panel renders that real source instead of the sample,
> with no other changes. Omit `code` and the sample stays. (Real source highlights the whole
> finding line; the sample highlights a token within it — a minor cosmetic difference.) To
> preview this path before your API is live, open the page with **`?real=1`** — it runs the
> scan against a mock `code` payload so you can see real-source rendering end to end.

To make it live, you change **one function** — `requestScan(target)` in
`js/analyzer-scan.js` (marked `=== BACKEND SEAM ===`):

```js
function requestScan(target) {
  return fetch("https://api.wewatchyourwebsite.com/v1/scan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ target: target })
  }).then(function (r) {
    if (!r.ok) throw new Error("Scan failed: " + r.status);
    return r.json();            // must match the ScanResult shape (documented inline)
  });
}
```

The `ScanResult` shape your API must return is documented as a comment right above that
function. Map your API's JSON to it once and the existing view renders real findings with
no other changes.

After wiring it:

- **Delete the demo notice** — the `[data-scan-demo-note]` line in `scanner/index.html`.
- **Allow the API origin in CSP.** When you enable the (currently commented) Content-
  Security-Policy in `_headers`, add your API origin to `connect-src` so the `fetch` is not
  blocked. Fonts/scripts are already self-hosted, so `connect-src` is the only addition the
  scanner needs.
- Consider real client-side validation/limits and a loading/error UI for slow or failed
  scans — the template handles the happy path and basic input validation; production error
  states (timeouts, rate limits, auth) are yours to add at the same seam.

### Request / response contract

The frontend sends the submitted target and expects a `ScanResult` back. A concrete shape
your API can implement (the full, authoritative field list is the JSDoc comment directly
above `requestScan` in `js/analyzer-scan.js`):

```jsonc
// Request  (POST, application/json)
{ "target": "github.com/acme/checkout-app" }

// Response (200, application/json) — a ScanResult
{
  "target":  "github.com/acme/checkout-app",   // echoed into the report header
  "file":    "src/auth.js",                     // shown in the window chrome
  "verdict": "action",                          // "clean" | "review" | "action"
  "summary": { "confirmed": 5, "critical": 1, "chains": 2, "owasp": "A03" },
  "stages": [                                    // exactly 8, in pipeline order (index 0–7)
    { "find": "hit", "count": 1 }, { "find": "hit" }, { "find": "hit", "count": 1 },
    { "find": "hit" }, { "find": "clean" }, { "find": "hit", "count": 1 },
    { "find": "verify" }, { "find": "verify" }  // find: "hit" | "clean" | "verify"
  ],
  "findings": [                                  // rendered as the report list
    { "sev": "critical", "title": "Hardcoded live API key", "cwe": "CWE-798",
      "owasp": "A07:2025", "where": "src/auth.js:4",
      "detail": "A production secret is committed in source." }
    // sev: "critical" | "high" | "medium" | "low"
  ],
  "code": {                                      // OPTIONAL — show the real fetched source
    "file": "src/auth.js",
    "lang": "javascript · fetched",
    "lines": [                                   // a line with `stage` highlights when that stage is a hit
      { "n": 1, "text": "import jwt from \"jsonwebtoken\"" },
      { "n": 4, "text": "const API_KEY = \"sk_live_…\"", "stage": 0 }
    ]
  }
}
```

The report, summary, stages, verdict, and chrome filename render from this object (and the
code panel too, if you include `code`), so once your endpoint returns it the page shows real
results with no other front-end changes.

> **Your backend owns the hard/risky parts.** Fetching and analyzing arbitrary repos means
> you — not this page — must handle abuse and resource limits: rate limiting, repository
> size/time caps, queueing, auth/quota ("one free scan per app"), and isolation of untrusted
> code. The static page deliberately does none of this; it just renders what your scanner
> returns. The `code` field is rendered safely (text only, never as HTML), but treat
> everything in the response as untrusted and validate server-side.

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
- [ ] **Scanner is a guided demo.** The `/scanner/` page runs a deterministic sample scan
      — it does **not** analyze anything the visitor submits, and nothing is transmitted.
      It becomes a real scanner the moment you point `requestScan()` at your analyzer API
      (see "Wiring the analyzer to a real backend" above). The on-page "Demo" notice should
      stay until that's wired.

---

## Ownership

This site was designed and built by WebPath Agency and is transferred to
Thomas J. Raef (WeWatchYourWebsite) for unrestricted use. See [LICENSE](LICENSE).
