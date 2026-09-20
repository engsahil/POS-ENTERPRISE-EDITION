/**
 * Mock sync backend, for testing only.
 *
 * Implements the contract in src/services/sync/README.md so the sync engine
 * can be exercised end to end. It is NOT part of the application and is never
 * bundled; it exists so claims about sync can be verified rather than assumed.
 *
 * Deliberately supports fault injection, because the interesting behaviour is
 * what happens when things go wrong:
 *
 *   POST /_control  { fail: 'network'|'500'|'reject'|'conflict'|null,
 *                     dropResponse: bool }
 *
 * `dropResponse` commits the write then returns an error, simulating the
 * classic duplicate-order scenario where the client never learns it succeeded.
 *
 * Usage:  node scripts/mock-sync-server.mjs [port]
 */

import { createServer } from 'node:http';

const port = Number(process.argv[2] ?? 4310);

/** entityId -> record. Keyed by entity id, so writes are idempotent. */
const store = new Map();
/** idempotencyKey -> result, so a retry returns the original outcome. */
const seenKeys = new Map();

let fault = { fail: null, dropResponse: false };
let requestCount = 0;

function json(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Content-Length': Buffer.byteLength(payload),
  });
  res.end(payload);
}

function readBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
    });
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        resolve({});
      }
    });
  });
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');

  if (req.method === 'OPTIONS') return json(res, 204, {});

  // ---- test control ----
  if (url.pathname === '/_control' && req.method === 'POST') {
    const body = await readBody(req);
    fault = { fail: body.fail ?? null, dropResponse: Boolean(body.dropResponse) };
    return json(res, 200, { ok: true, fault });
  }

  if (url.pathname === '/_state') {
    return json(res, 200, {
      requestCount,
      records: [...store.values()],
      count: store.size,
      // How many distinct entity ids exist per entity type - the duplicate check.
      byEntity: [...store.values()].reduce((acc, r) => {
        acc[r.entity] = (acc[r.entity] ?? 0) + 1;
        return acc;
      }, {}),
    });
  }

  if (url.pathname === '/_reset' && req.method === 'POST') {
    store.clear();
    seenKeys.clear();
    requestCount = 0;
    fault = { fail: null, dropResponse: false };
    return json(res, 200, { ok: true });
  }

  if (url.pathname === '/health') return json(res, 200, { ok: true });

  // ---- sync ----
  if (url.pathname === '/sync' && req.method === 'POST') {
    requestCount += 1;

    if (fault.fail === 'network') {
      req.socket.destroy();
      return;
    }
    if (fault.fail === '500') {
      return json(res, 500, { error: 'Simulated server error' });
    }

    const body = await readBody(req);
    const items = Array.isArray(body.items) ? body.items : [];
    const results = [];

    for (const item of items) {
      // Idempotency: a retry with the same key returns the first outcome and
      // does not write again.
      if (seenKeys.has(item.idempotencyKey)) {
        results.push({ ...seenKeys.get(item.idempotencyKey), status: 'duplicate' });
        continue;
      }

      if (fault.fail === 'reject') {
        const result = { id: item.id, status: 'rejected', message: 'Simulated rejection' };
        results.push(result);
        continue;
      }

      if (fault.fail === 'conflict') {
        const serverRecord = {
          ...(item.payload ?? {}),
          id: item.entityId,
          name: 'Server wins',
          updatedAt: new Date().toISOString(),
          rev: (item.rev ?? 1) + 5,
        };
        store.set(item.entityId, { entity: item.entity, id: item.entityId, record: serverRecord });
        const result = { id: item.id, status: 'conflict', serverRecord };
        seenKeys.set(item.idempotencyKey, { id: item.id, status: 'accepted' });
        results.push(result);
        continue;
      }

      // Normal accept. Keyed by entity id, so even a duplicate id cannot
      // create a second record.
      store.set(item.entityId, {
        entity: item.entity,
        id: item.entityId,
        operation: item.operation,
        record: item.payload,
        rev: item.rev,
      });
      const result = { id: item.id, status: 'accepted' };
      seenKeys.set(item.idempotencyKey, result);
      results.push(result);
    }

    // Commit, then fail: the client never learns it worked and will retry.
    if (fault.dropResponse) {
      req.socket.destroy();
      return;
    }

    return json(res, 200, { results });
  }

  return json(res, 404, { error: 'Not found' });
});

server.listen(port, () => {
  console.log(`mock sync server on http://localhost:${port}`);
});
