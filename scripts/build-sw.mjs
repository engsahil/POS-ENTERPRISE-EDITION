/**
 * Generate the service worker precache manifest after a build.
 *
 * Every emitted asset is listed explicitly, so the whole application shell is
 * available offline after the FIRST visit. Relying on runtime caching alone
 * meant a route the operator had never opened while online would fail
 * offline - which is unacceptable for a till.
 *
 * Run automatically by `npm run build` (see package.json).
 */

import { readdir, readFile, writeFile, stat } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';

const dist = resolve('dist');
const swSource = resolve('src/pwa/sw.template.js');
const swOutput = join(dist, 'sw.js');

/** Everything worth precaching; hashed assets plus the static shell files. */
const PRECACHE_EXTENSIONS = new Set([
  '.js',
  '.css',
  '.html',
  '.webmanifest',
  '.svg',
  '.png',
  '.ico',
  '.woff',
  '.woff2',
]);

/** Files that must never be precached. */
const EXCLUDE = new Set(['sw.js', 'robots.txt']);

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await walk(full)));
    } else {
      out.push(full);
    }
  }
  return out;
}

const files = await walk(dist);

const assets = files
  .map((file) => relative(dist, file).split(/[\\/]/).join('/'))
  .filter((rel) => {
    if (EXCLUDE.has(rel)) return false;
    const dot = rel.lastIndexOf('.');
    return dot !== -1 && PRECACHE_EXTENSIONS.has(rel.slice(dot));
  })
  .sort();

// Cache-bust the worker whenever any asset changes, so an update is picked up.
const stats = await Promise.all(
  assets.map(async (rel) => {
    const info = await stat(join(dist, rel));
    return `${rel}:${info.size}`;
  }),
);
const revision = Buffer.from(stats.join('|'))
  .toString('base64')
  .replace(/[^a-zA-Z0-9]/g, '')
  .slice(0, 16);

const template = await readFile(swSource, 'utf8');
const output = template
  .replace('__PRECACHE_MANIFEST__', JSON.stringify(assets, null, 2))
  .replace('__BUILD_REVISION__', JSON.stringify(revision));

await writeFile(swOutput, output, 'utf8');

console.log(
  `  service worker: precaching ${assets.length} files (revision ${revision})`,
);
