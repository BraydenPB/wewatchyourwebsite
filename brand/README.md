# Brand assets — master logo files

Editable, print-quality master files for the WeWatchYourWebsite logo. These are the
**source artwork** for design and print use. They are **not used by the website** and are
**not published** to the live site (the deploy allowlist in `deploy.js` excludes this folder).

The site itself uses small, web-optimized marks in [`../assets/img/`](../assets/img/) — see
"What the website actually uses" below.

## Files

Two lockups (vertical and horizontal), each in six formats:

| File | Format | Best for |
| --- | --- | --- |
| `*-logo.ai` | Adobe Illustrator | Editing the vector master (primary source) |
| `*-logo.eps` | Encapsulated PostScript | Vector hand-off to print shops / other vector tools |
| `*-logo.pdf` | PDF (vector) | Sharing / printing without design software |
| `*-logo.psd` | Photoshop | Layered raster master |
| `*-logo.png` | PNG (raster, transparent) | Slides, docs, quick digital use |
| `*-logo.jpg` | JPEG (raster, flat bg) | Anywhere JPEG is required |

- `vertical-logo.*` — stacked shield-over-wordmark lockup.
- `horizontal-logo.*` — shield-left, wordmark-right lockup.

For vector use prefer **`.ai`** (to edit) or **`.eps` / `.pdf`** (to place/print). For raster
use prefer **`.png`** (transparent) over `.jpg`.

## What the website actually uses

The live site does **not** load these masters. Its brand marks live in `../assets/img/`:

- `favicon.svg`, `apple-touch-icon.png`, `icon-192.png`, `icon-512.png` — favicon / PWA icons.
- `horz-bnw-black.svg` — the horizontal wordmark referenced by the structured data.
- The header/footer wordmark is an **inline SVG `<symbol>` sprite** embedded at the top of
  `index.html` and `scanner/index.html` (recolored for the dark theme) — not an image file.
- `og-image.jpg` — the social-share preview image.

If the logo changes, update the inline sprite + the files in `assets/img/` to match these
masters; the masters here are the canonical source to derive those from.
