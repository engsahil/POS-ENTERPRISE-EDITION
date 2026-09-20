/**
 * Minimal static server for the production build.
 *
 * Why this exists: opening dist/index.html directly with file:// cannot work.
 * Browsers block ES modules loaded from file:// under the CORS policy
 * ("origin 'null'"), so the page renders white no matter how the app is
 * built. A build must be served over http://.
 *
 * Uses only Node's standard library, so it needs no extra dependency.
 * Usage:  npm run build && npm run serve   (then open the printed URL)
 */

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, resolve, normalize, sep } from 'node:path';

const root = resolve(process.argv[2] ?? 'dist');
const port = Number(process.env.PORT ?? 4173);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

async function send(res, status, body, type) {
  res.writeHead(status, {
    'Content-Type': type ?? 'text/plain; charset=utf-8',
    'Cache-Control': 'no-cache',
  });
  res.end(body);
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', 'http://localhost');
    // Block path traversal: resolve, then require the result stays in root.
    const rel = normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, '');
    let filePath = resolve(root, rel);
    if (filePath !== root && !filePath.startsWith(root + sep)) {
      return send(res, 403, 'Forbidden');
    }

    let info = await stat(filePath).catch(() => null);
    if (info?.isDirectory()) {
      filePath = join(filePath, 'index.html');
      info = await stat(filePath).catch(() => null);
    }

    // Single-page app: unknown paths fall back to index.html so deep links
    // like /menu work on a full page load.
    if (!info) {
      filePath = join(root, 'index.html');
      info = await stat(filePath).catch(() => null);
      if (!info) return send(res, 404, 'Build not found. Run: npm run build');
    }

    const body = await readFile(filePath);
    return send(res, 200, body, TYPES[extname(filePath)] ?? 'application/octet-stream');
  } catch {
    return send(res, 500, 'Server error');
  }
});

server.listen(port, () => {
  console.log(`\n  POS build served at  http://localhost:${port}\n`);
  console.log('  Opening dist/index.html directly (file://) will NOT work:');
  console.log('  browsers block ES modules over file://. Use the URL above.\n');
});
