// Minimal static dev server. Usage: npm run dev  (serves on http://localhost:8098)
const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 8098;
const HOST = "127.0.0.1"; // loopback only — never expose the repo root on the LAN
const ROOT = __dirname;
const TYPES = {
  ".html": "text/html", ".css": "text/css", ".js": "text/javascript",
  ".json": "application/json", ".webmanifest": "application/manifest+json",
  ".svg": "image/svg+xml", ".png": "image/png",
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp",
  ".gif": "image/gif", ".woff2": "font/woff2", ".woff": "font/woff", ".ttf": "font/ttf",
  ".xml": "application/xml", ".txt": "text/plain",
};

http.createServer((req, res) => {
  let f;
  try {
    f = decodeURIComponent(req.url.split("?")[0]);
  } catch {
    // Malformed percent-encoding (e.g. a stray "%") — don't crash the server.
    res.writeHead(400); res.end("400"); return;
  }
  // Reject control chars (code < 0x20). A decoded NUL byte (e.g. "%00") slips past
  // the checks below but makes fs.readFile throw a synchronous TypeError that escapes
  // the async callback and crashes the server. charCodeAt avoids a literal control
  // char in source; rejecting the whole C0 range is harmless for legitimate URLs.
  for (let i = 0; i < f.length; i++) {
    if (f.charCodeAt(i) < 0x20) { res.writeHead(400); res.end("400"); return; }
  }
  if (f.endsWith("/")) f += "index.html";
  // Defense-in-depth: never serve dotfiles (.git/…) or the private memory/ notes,
  // even though the server already binds loopback-only.
  if (/(^|[\\/])\.|(^|[\\/])memory([\\/]|$)/.test(f)) { res.writeHead(404); res.end("404"); return; }
  f = path.normalize(path.join(ROOT, f));
  // Contain requests to ROOT — reject path-traversal (e.g. /../../etc/passwd).
  if (f !== ROOT && !f.startsWith(ROOT + path.sep)) { res.writeHead(403); res.end("403"); return; }
  fs.readFile(f, (err, data) => {
    if (err) { res.writeHead(404); res.end("404"); return; }
    res.writeHead(200, { "content-type": TYPES[path.extname(f).toLowerCase()] || "application/octet-stream" });
    res.end(data);
  });
}).listen(PORT, HOST, () => console.log(`wwyw2 dev server → http://localhost:${PORT}`));
