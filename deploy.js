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
//   npm run deploy   -> assemble dist/ AND push it to Pages (project: wwyw2)
//
// Requires: wrangler logged in, and CLOUDFLARE_ACCOUNT_ID set to the WebPath
// Agency account (the script sets a sensible default if unset).

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const ROOT = __dirname;
const DIST = path.join(ROOT, "dist");

// The ONLY things that get published. Files are copied as-is; dirs recursively.
const PUBLISH = ["index.html", "assets", "css", "js"];

const PROJECT = "wwyw2";
const ACCOUNT_ID =
  process.env.CLOUDFLARE_ACCOUNT_ID || "75620f084ea25ade5ee57a71a830bba2"; // WebPath Agency

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
  build();
  console.log(`Deploying dist/ to Pages project "${PROJECT}"...`);
  // Single command string (all args are static/trusted) so Node doesn't warn
  // about passing an args array with shell:true. shell:true is needed on
  // Windows, where `wrangler` is a .cmd shim.
  const cmd = `wrangler pages deploy dist --project-name=${PROJECT} --branch=main --commit-dirty=true`;
  execSync(cmd, {
    stdio: "inherit",
    env: { ...process.env, CLOUDFLARE_ACCOUNT_ID: ACCOUNT_ID },
  });
}

const mode = process.argv[2];
if (mode === "deploy") deploy();
else build();
