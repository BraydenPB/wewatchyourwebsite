// Build a clean publish folder and deploy it to Cloudflare Pages.
//
// Why a build step: `wrangler pages deploy .` would publish the ENTIRE repo —
// including memory/, package.json, serve.js, and dotfiles — because Pages does
// not reliably honor .assetsignore for a plain directory deploy. We learned
// that the hard way (memory notes briefly went live). This script uses an
// ALLOWLIST: only the paths below are published, so anything new added to the
// repo (more memory notes, configs, secrets) is excluded by default.
//
// Usage:
//   npm run build    -> just assemble dist/ (inspect before shipping)
//   npm run deploy   -> assemble dist/ AND push it to Pages
//
// Requires: wrangler logged in, and CLOUDFLARE_ACCOUNT_ID set to your own
// Cloudflare account (there is no built-in default — deploy throws if unset).
// Optionally set CLOUDFLARE_PROJECT to override the Pages project name.

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const ROOT = __dirname;
const DIST = path.join(ROOT, "dist");

// The ONLY things that get published. Files are copied as-is; dirs recursively.
// (robots.txt, sitemap.xml, _headers are root-level static config Cloudflare reads.
// privacy-policy/ and terms-of-service/ are placeholder legal pages — see README.)
const PUBLISH = [
  "index.html", "assets", "css", "js",
  "robots.txt", "sitemap.xml", "_headers", "site.webmanifest",
  "privacy-policy", "terms-of-service", "scanner",
];

// Cloudflare Pages target. Both are required via environment for a clean handoff —
// set CLOUDFLARE_PROJECT and CLOUDFLARE_ACCOUNT_ID (plus CLOUDFLARE_API_TOKEN in CI)
// to your own Cloudflare account. See README → "Deploying".
const PROJECT = process.env.CLOUDFLARE_PROJECT || "wwyw2";
const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;

// PROJECT is interpolated into the deploy shell command below, so validate it
// against Cloudflare Pages' own project-name rules (lowercase alphanumeric and
// hyphens, no leading/trailing hyphen, <=58 chars). This both catches typos and
// prevents shell-metacharacter injection via a malformed CLOUDFLARE_PROJECT.
if (!/^[a-z0-9](?:[a-z0-9-]{0,56}[a-z0-9])?$/.test(PROJECT)) {
  throw new Error(
    `Invalid CLOUDFLARE_PROJECT "${PROJECT}". Cloudflare Pages project names must be ` +
      "lowercase letters, numbers, and hyphens (no leading/trailing hyphen), max 58 chars."
  );
}

function rmrf(p) {
  fs.rmSync(p, { recursive: true, force: true });
}

function copyRecursive(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src)) {
      copyRecursive(path.join(src, entry), path.join(dest, entry));
    }
  } else {
    fs.copyFileSync(src, dest);
  }
}

function build() {
  rmrf(DIST);
  fs.mkdirSync(DIST, { recursive: true });

  let count = 0;
  for (const item of PUBLISH) {
    const src = path.join(ROOT, item);
    if (!fs.existsSync(src)) {
      console.warn(`! skipping "${item}" — not found`);
      continue;
    }
    copyRecursive(src, path.join(DIST, item));
    count++;
  }

  // Safety net: assert no sensitive paths slipped in via a future PUBLISH edit.
  const FORBIDDEN = ["memory", "package.json", "serve.js", "deploy.js", ".git", ".claude", ".agents"];
  for (const bad of FORBIDDEN) {
    if (fs.existsSync(path.join(DIST, bad))) {
      throw new Error(`Refusing to deploy: "${bad}" ended up in dist/. Fix PUBLISH.`);
    }
  }

  const fileCount = countFiles(DIST);
  console.log(`Built dist/ from ${count} entr${count === 1 ? "y" : "ies"} (${fileCount} files).`);
  return DIST;
}

function countFiles(dir) {
  let n = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    n += entry.isDirectory() ? countFiles(p) : 1;
  }
  return n;
}

function deploy() {
  if (!ACCOUNT_ID) {
    throw new Error(
      "CLOUDFLARE_ACCOUNT_ID is not set. Set it (and CLOUDFLARE_API_TOKEN in CI) " +
        "to your own Cloudflare account before deploying. See README → Deploying."
    );
  }
  build();
  console.log(`Deploying dist/ to Pages project "${PROJECT}"...`);
  // Single command string (PROJECT is validated above; all other args are static)
  // so Node doesn't warn about passing an args array with shell:true. shell:true is
  // needed on Windows, where `wrangler` is a .cmd shim.
  const cmd = `wrangler pages deploy dist --project-name=${PROJECT} --branch=main --commit-dirty=true`;
  execSync(cmd, {
    stdio: "inherit",
    env: { ...process.env, CLOUDFLARE_ACCOUNT_ID: ACCOUNT_ID },
  });
}

const mode = process.argv[2];
if (mode === "deploy") deploy();
else build();
