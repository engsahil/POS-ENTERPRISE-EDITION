# Synchronisation

## Flow

```
offline change -> local database -> sync queue
               -> internet available -> synchronise
               -> confirm success -> mark synced
```

Local writes are always applied immediately. Every write to a syncable store
passes through `data/repositories/changeTracker.ts`, which enqueues it. The
engine drains the queue in the background whenever a backend is configured and
the device is online.

**Billing is never blocked by sync.** Completing an order writes locally and
returns; queueing happens afterwards and its failures are swallowed.

## Enabling

```
VITE_SYNC_API_URL=https://api.example.com/pos
```

Unset, sync is inert - but the queue still accumulates, so enabling a backend
later uploads everything recorded in the meantime.

## Contract

### `GET /health`
`200` when reachable.

### `POST /sync`

```json
{
  "items": [
    {
      "id": "queue-entry-id",
      "idempotencyKey": "generated-once-per-change",
      "entity": "orders",
      "entityId": "order-id",
      "operation": "create",
      "payload": { "order": {}, "items": [], "sale": {} },
      "rev": 1,
      "updatedAt": "2026-09-02T10:00:00.000Z"
    }
  ]
}
```

Response:

```json
{
  "results": [
    { "id": "queue-entry-id", "status": "accepted" }
  ]
}
```

`status` is one of:

| Status | Meaning | Engine behaviour |
| --- | --- | --- |
| `accepted` | Stored | Mark synced |
| `duplicate` | Already had it (a retry) | Mark synced - the desired end state |
| `conflict` | Server version wins | Apply `serverRecord` locally, mark synced |
| `rejected` | Will never be accepted | Park as failed for review |

## Guarantees

**No duplicate orders.** `idempotencyKey` is generated once when the change is
queued and reused on every retry. The server must key on it. This covers the
dangerous case where the server commits but the response is lost: the retry
returns `duplicate` rather than creating a second order.

**No data loss.** Items are removed only after the server confirms them. A
failure returns the item to the queue with exponential backoff; after
`maxAttempts` it is parked as `failed` and surfaced in the UI with a Retry
action. Nothing is ever discarded.

**Safe retry.** Exponential backoff (1s, 5s, 15s, 60s, 5m), an attempt cap, a
single-flight lock so two drains cannot overlap, and recovery of items left
`syncing` by an interrupted run.

**Safe conflicts.** Orders, order items and sales are immutable history and
are never overwritten by the server. Mutable config (menu, prices, inventory,
deals, restaurant profile) resolves last-write-wins, and a server-won conflict
is applied locally so both sides converge.

## Not synced

The sync queue itself, `settings`, `admin` credentials and `license` are
per-terminal and are deliberately excluded.
