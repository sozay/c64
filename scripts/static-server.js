// Dependency-free static file server for the measurement harness (T-203).
//
// Serves a directory (the built dist/ production bundle) over HTTP using only
// node:http/node:fs, so `scripts/measure.js` adds no external dependency beyond
// the Playwright devDependency introduced by T-201. The server binds an
// ephemeral port by default and resolves with the URL the harness records in
// its report, which is what makes the p95 frame-time gate reproducible.

import http from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import path from 'node:path';

const MIME_TYPES = Object.freeze({
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
});

function contentTypeFor(filePath) {
  return MIME_TYPES[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream';
}

function resolveRequestPath(root, requestUrl, host) {
  const url = new URL(requestUrl, `http://${host}`);
  let pathname = decodeURIComponent(url.pathname);
  if (pathname.endsWith('/')) pathname += 'index.html';

  const filePath = path.normalize(path.join(root, pathname));
  // Reject traversal outside the served root.
  if (filePath !== root && !filePath.startsWith(`${root}${path.sep}`)) return null;
  return filePath;
}

// Starts the server and resolves with { url, port, host, root, close() }.
export function startStaticServer(rootDir, { host = '127.0.0.1', port = 0 } = {}) {
  const root = path.resolve(rootDir);
  if (!existsSync(root)) {
    return Promise.reject(new Error(`Static server root does not exist: ${root}`));
  }

  const server = http.createServer((req, res) => {
    let filePath;
    try {
      filePath = resolveRequestPath(root, req.url ?? '/', req.headers.host ?? host);
    } catch {
      res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Bad request');
      return;
    }

    if (!filePath) {
      res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Forbidden');
      return;
    }

    try {
      let target = filePath;
      if (existsSync(target) && statSync(target).isDirectory()) {
        target = path.join(target, 'index.html');
      }
      if (!existsSync(target) || !statSync(target).isFile()) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Not found');
        return;
      }

      res.writeHead(200, {
        'Content-Type': contentTypeFor(target),
        'Cache-Control': 'no-store',
      });
      createReadStream(target).pipe(res);
    } catch {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Internal server error');
    }
  });

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      const address = server.address();
      resolve({
        host,
        port: address.port,
        root,
        url: `http://${host}:${address.port}/`,
        close: () =>
          new Promise((done) => {
            server.close(() => done());
          }),
      });
    });
  });
}
