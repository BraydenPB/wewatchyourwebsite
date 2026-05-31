// Minimal static dev server. Usage: npm run dev  (serves on http://localhost:8098)
const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 8098;
const ROOT = __dirname;
const TYPES = {
  ".html": "text/html", ".css": "text/css", ".js": "text/javascript",
  ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png",
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp",
  ".gif": "image/gif", ".woff2": "font/woff2", ".woff": "font/woff", ".ttf": "font/ttf",
};

http.createServer((req, res) => {
  let f = decodeURIComponent(req.url.split("?")[0]);
  if (f.endsWith("/")) f += "index.html";
  f = path.join(ROOT, f);
  fs.readFile(f, (err, data) => {
    if (err) { res.writeHead(404); res.end("404"); return; }
    res.writeHead(200, { "content-type": TYPES[path.extname(f).toLowerCase()] || "application/octet-stream" });
    res.end(data);
  });
}).listen(PORT, () => console.log(`wwyw2 dev server → http://localhost:${PORT}`));
