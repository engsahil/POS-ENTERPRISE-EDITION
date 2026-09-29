# POS — v1.1.0

Offline-first Point of Sale application. **Step 3: Admin Authentication.**

Architecture (Step 1), application shell and navigation (Step 2), and admin
login with route protection (Step 3). No business logic yet — the four
sections remain empty states behind the login.

## Stack

React 18 · TypeScript (strict) · Vite 5 · React Router 6 · CSS Modules + design tokens.

Runtime dependencies: **3** (`react`, `react-dom`, `react-router-dom`). No UI kit,
no icon library, no state library, no IndexedDB wrapper — all hand-rolled and minimal.

## First run

```bash
cp .env.example .env      # set your own admin credentials
npm install
npm run dev        # dev server on :5173
npm run build      # typecheck + production build to dist/
npm run preview    # serve the production build on :4173
npm run typecheck  # types only
```

## Running a production build locally

```bash
npm run build
npm run serve      # then open the printed http://localhost:4173
```

**Opening `dist/index.html` directly (a `file://` URL) shows a white screen.**
That is not a fault in the build: browsers block ES modules loaded over
`file://` under the CORS policy (`origin 'null'`), so the scripts never
execute. Verified against a minimal two-line test page - any external
`type="module"` script fails the same way. A build must be served over
`http://`.

`npm run serve` uses only Node's standard library (no extra dependency) and
includes the single-page-app fallback, so deep links such as `/menu` work on a
full page load. Any static server works equally well.

Assets are emitted with **relative** paths (`base: './'`), so the build also
runs correctly from a sub-path such as `https://example.com/pos/`. The router
derives its basename from the served directory, so routing works there too.
Set `VITE_BASE=/your/path/` at build time if you need an absolute public path.

## Structure

```
public/
  manifest.webmanifest   PWA manifest
  sw.js                  app-shell service worker
  icons/                 svg + 192/512 + maskable png
src/
  app/
    App.tsx              router composition + error boundary
    AuthContext.tsx      auth provider & useAuth hook
    RequireAuth.tsx      route guard
    routes.tsx           route & navigation registry (single source of truth)
  components/
    layout/              AppLayout, Sidebar, TabBar, OfflineBanner,
                         PageHeader, ErrorBoundary
    admin/               AdminNav, DashboardSection, ManageLinkSection,
                         AboutSection, LegalDocumentView,
                         RestaurantProfileForm, PrinterSection,
                         SecuritySection, LicenseSection, SettingsSection,
                         LogoField, ImageField, PriceInput
    deals/               DealForm, DealList, DealProductPicker
    inventory/           InventoryForm, InventoryList
    pos/                 ItemGrid, DealGrid, CartPanel, OrderConfirmation
    receipt/             Receipt (58/80mm layout), ReceiptView, PrintPanel
    sales/               SummaryCard, WeekChart
    menu/                MenuItemForm, MenuItemList
    ui/                  Button, Card, EmptyState, Input, Spinner, Textarea,
                         Icons
  content/
    legal.ts             Privacy Policy, Terms, vendor identity, app info
  config/
    app.config.ts        version, locale, CURRENCY (PKR only)
    license.config.ts    licence public key, policy, optional API URL
    sync.config.ts       sync endpoint, batching, backoff
    auth.config.ts       bootstrap credentials, session & lockout policy
    storage.config.ts    DB name/version, object stores & indexes
  data/
    db/indexedDb.ts      promise wrapper over IndexedDB
    db/migrations.ts     versioned, idempotent schema migrations
    repositories/        generic typed repository factory + registry
    storage/             safe localStorage for UI preferences
  hooks/                 useOnlineStatus, useMenu, useInventory, useDeals,
                         useCart, useSales, useSyncStatus, useInstallState
  pages/                 Login, Pos, Sales, Menu, Deals, Inventory, Admin,
                         NotFound
  services/              authService (login, session, credentials)
                         databaseService (startup, diagnostics, reset)
                         dealService, escpos (ESC/POS encoder), inventoryService,
                         menuService, orderService, printService,
                         licenseService, license/validator (pluggable),
                         printerService, receiptService,
                         restaurantService, salesService, settingsService,
                         syncQueueService
  pwa/                   service worker registration, sw.template.js,
                         installService (install capability detection)
  styles/                tokens.css, reset.css, global.css, print.css
  types/                 common + domain entity types
  utils/                 currency, crypto (PBKDF2), date, id, cn, image
```

## Local database

All data lives in IndexedDB (`pos-db`, version 4) so the terminal keeps working
without a network connection. There is no demo data — the database starts
completely empty apart from the admin account created on first sign-in.

### Stores

| Store | Contents |
| --- | --- |
| `admin` | Admin account and password hash (unique `by_username`) |
| `restaurant` | Restaurant profile, tax configuration |
| `menuItems` | Menu items |
| `itemPrices` | Sizes and prices per menu item |
| `inventory` | Stock levels and reorder points |
| `deals` | Deals and combo definitions |
| `orders` | Order headers (unique `by_orderNumber`) |
| `orderItems` | Order line items |
| `sales` | Completed sales, indexed by business date |
| `license` | Licence/activation state |
| `settings` | Key/value preferences |
| `syncQueue` | Pending local changes awaiting upload |

### Guarantees

- **Stable IDs** — every record gets a collision-resistant string `id`.
- **Timestamps** — `createdAt` is written once and never changes; `updatedAt`
  advances on every write; `rev` increments for conflict resolution.
- **Durable** — data survives page refresh *and* a full browser restart. It is
  not held in React state or memory.
- **Soft deletes** — `remove()` sets `deletedAt` so the deletion can be synced
  later; `list()` hides those rows. Pass `{ hard: true }` to erase.
- **Migrations** — versioned and idempotent in `src/data/db/migrations.ts`.
  Never edit a shipped migration; always add a new one.
- **Offline-first** — local writes are the source of truth and are queued in
  `syncQueue` for a future backend. Nothing is uploaded yet.

Repositories are the only supported way to touch the database:

```ts
import { menuItemsRepository } from '@/data/repositories';

const item = await menuItemsRepository.create({ name: 'Chicken Karahi', ... });
await menuItemsRepository.update(item.id, { name: 'Chicken Karahi (Full)' });
```

## Synchronisation

```
offline change -> local database -> sync queue
               -> internet available -> synchronise
               -> confirm success -> mark synced
```

Sync is **off unless `VITE_SYNC_API_URL` is set**. Unset, the app is purely
local - but changes still queue durably, so connecting a backend later uploads
everything recorded in the meantime. The contract is in
`src/services/sync/README.md`.

**Billing is never blocked.** Completing an order writes locally and returns;
queueing happens afterwards and its failures are swallowed. A sale completed in
**64ms** during testing while sync was mid-error.

### Guarantees

**No duplicate orders.** Each queue item carries an idempotency key generated
once at enqueue and reused on every retry. This covers the dangerous case
where the server commits but the response is lost: the retry returns
`duplicate`, which counts as success. Verified by making the mock server
commit and then kill the connection - the retry produced no second order.

**No data loss.** Items are removed only after the server confirms them. A
failure returns the item to the queue with exponential backoff (1s, 5s, 15s,
60s, 5m); after 5 attempts it is parked as `failed` and surfaced with a Retry
action. Nothing is ever discarded.

**Safe retry.** Backoff, an attempt cap, a single-flight lock so two drains
cannot overlap, recovery of items left `syncing` by an interrupted run, and a
hard bound on batches per drain so sync always terminates.

**Safe conflicts.** Orders, order items and sales are immutable history and are
never overwritten. Mutable config resolves last-write-wins, and a server-won
conflict is applied locally so both sides converge.

### Change tracking

Every repository write funnels through
`data/repositories/changeTracker.ts`, so a new feature cannot forget to queue
its changes - "no data loss" is a property of the architecture, not of
discipline. Orders enqueue a composite payload (header + items + sale) so a
sale stays atomic on the wire. The queue, settings, admin credentials and
licence are per-terminal and excluded.

### Status indicator

Offline / Syncing / Synced / Sync error, with a pending count and a Retry
action on error. It renders nothing when no backend is configured, so a local
install gains no dead chrome.

## Performance and motion

Measured with 60 menu items, 12 deals and 30 stock lines - performance with a
single record proves nothing.

| Metric | Result |
| --- | --- |
| Screen render | 133-197ms across all six screens |
| Add to cart | 25ms |
| Complete an order | ~0.5s |
| Frame pacing | 16.6ms average, p95 16.8ms |
| Dropped frames | 0 |
| Cumulative layout shift | 0.000 |

### Motion

Every animation targets `transform` and `opacity` only, so it runs on the
compositor and is not capped by layout work. Three animations were converted
during this audit: the sales chart and the sidebar active marker both animated
`height` (forcing layout on every frame), and the chart's transition became a
`scaleY` keyframe from a fixed origin.

Durations come from four tokens (90/150/220/320ms) with a single shared
easing curve, so motion feels consistent rather than assembled. Everything is
disabled under `prefers-reduced-motion`, verified to leave zero animated
elements.

Frame rate is bounded by the display, not the application: with no layout work
in any animation, the compositor is free to present at whatever refresh rate
the hardware offers. The headless browser used for testing caps at 60Hz, so
60fps with zero dropped frames is the ceiling that could be measured here -
higher-refresh hardware was not available to verify 90fps directly.

### Touch targets

Cart controls are visually compact so the panel is not dominated by chrome,
but expand to a 44x44 hit area on touch devices via a pseudo-element, which
costs no layout space.

## Security posture

A dedicated audit (Step 19) probed authentication, credentials, input
validation, persistence, destructive actions, licence handling, secrets, local
storage, sync and error handling. It found **12 issues, all now fixed**. The
notes below record the resulting design.

### No secrets in the bundle

A bundled application cannot keep a secret: anything read through
`import.meta.env` is inlined into the JavaScript served to the browser. The
audit confirmed the previous build shipped the admin password in
`dist/assets/index-*.js`.

The application no longer ships one. On first run it generates a random
one-time setup password with the CSPRNG, displays it on the sign-in screen,
stores only its PBKDF2 hash, and requires the operator to set their own
password. `VITE_ADMIN_PASSWORD` is still honoured for test automation and
kiosk provisioning, and `.env.example` states plainly that anything set there
is readable by anyone.

### Session tokens are bound to the account

A session in `localStorage` is only honoured if its token hashes to the value
recorded on the admin record at sign-in. Before this fix, a hand-written
session object granted full admin access with no password - an authentication
bypass. Signing out and changing credentials both invalidate the stored token.

### Validation at the service boundary

`utils/validate.ts` guards every value that reaches storage. UI validation
alone was insufficient: anything bypassing a form reached the database
unchecked, and a single `NaN` price made the entire day's sales total `null`.

| Value | Rule |
| --- | --- |
| Order price | Finite, non-negative, bounded, rounded to integer paisa |
| Order quantity | Whole number, at least 1, bounded |
| Stock level | Non-finite becomes 0; clamped and rounded to 3 decimals |
| Menu price | Invalid becomes `null` (not offered) rather than `NaN` |
| Percentages | Clamped to 0-100 |
| Text | Trimmed and length-bounded |

Aggregation is defensive too: sales totals treat a non-finite stored value as
zero, so a bad row written by an earlier build cannot corrupt today's figures.

### Destructive actions

Deleting a menu item, stock line or deal, marking stock out, and deactivating
a licence all require explicit confirmation and can be cancelled.

## About, legal and branding

**Admin > About** holds application information, the Privacy Policy, the
Terms & Regulations, and the vendor attribution.

### Application information

Version, currency (Pakistani Rupees, `Rs.`), currency code, locale, time
zone, storage model and provider - all read from `config/app.config.ts` so
they cannot drift from the real build.

### Legal documents

`src/content/legal.ts` holds both documents as structured data rather than
markup, so the same text could be exported or printed without duplication.
The wording describes this application's **actual** behaviour: all business
data is stored locally, there is no telemetry, and nothing is transmitted
unless the operator configures a sync or licence endpoint. If that behaviour
changes, these documents must be updated to match.

Three fields are left as bracketed placeholders because only the operator can
supply them: registered business name, contact email and jurisdiction.

### Branding is confined to About

`VENDOR` is defined once in `content/legal.ts` and rendered only in the About
section. The POS, Sales, Menu, Inventory, Deals and login screens carry no
vendor branding, and receipts show the operator's own restaurant identity.
This is enforced by tests that scan each screen for the vendor name.

## Installing the application

The POS is a full PWA: manifest, service worker, offline caching, standalone
display, maskable icons and app shortcuts.

### Install support is reported honestly

An install button is **only** shown when the browser has actually given the
app a usable install prompt. `pwa/installService.ts` resolves to one of:

| State | Browser | What Admin > Install shows |
| --- | --- | --- |
| `promptable` | Chrome, Edge, Samsung | A real **Install application** button |
| `manual-ios` | Safari on iOS/iPadOS | The genuine Share -> Add to Home Screen steps |
| `unsupported` | Firefox desktop, others | An explanation, and no button |
| `installed` | Running standalone | Confirmation it is installed |

No browser is ever shown a button that would do nothing.

### Startup experience

`index.html` carries inlined boot styles and a small spinner so a standalone
launch goes OS splash -> branded background -> app, with no white flash. The
placeholder is removed as soon as React paints.

### Standalone behaviour

When running installed, the app honours display cutouts via safe-area insets,
disables overscroll rubber-banding, suppresses the tap-highlight flash, and
turns off text selection on chrome while keeping inputs and receipts
selectable. None of this affects the browser experience.

### Shortcuts

The app icon exposes jump targets for New order, Sales and Menu.

## Offline-first

The application is designed to run with no internet at all. Normal billing
never touches the network.

### What makes it work

- **All data is local.** Orders, menu, inventory, deals, sales, settings and
  licence state live in IndexedDB. There is no API call anywhere in the
  billing path.
- **The whole build is precached.** `scripts/build-sw.mjs` runs after every
  build and injects a manifest of every emitted file into the service worker,
  so all 38 assets are cached on install. Runtime caching alone was not
  enough: a route the operator had never opened while online would fail
  offline.
- **Navigations are served cache-first**, then refreshed in the background, so
  deep links work offline and updates are still picked up.
- **Connectivity is verified, not assumed.** After a page load served from
  cache, `navigator.onLine` can report `true` with no connection. A small
  same-origin probe against an intentionally un-cached file confirms the real
  state, so the offline indicator is accurate.

### Known limits, stated plainly

Direct ESC/POS printing still needs the platform to allow it (Chromium with
WebUSB/Web Serial, secure context) - that is a platform constraint, not a
network one, and receipt generation and browser printing work offline
regardless. If a licence API is ever configured, activation of a *new* key
would need connectivity; an already-activated terminal stays activated
offline indefinitely.

## Licensing

Every installation starts **NOT ACTIVATED**. Entering a valid key in
**Admin > License** moves it to **ACTIVATED**, and that state persists locally.

### How a key is judged valid

Keys are `POS1.<payload>.<signature>` where the signature is **Ed25519** over
the payload, verified in the browser against the public key embedded in
`config/license.config.ts`. Forging a key without the private signing key is
not feasible.

The private signing key lives outside the repository in `.secrets/` (which is
git-ignored) and must never ship. Only the public key belongs in the app.

### What this is not

**A client-side check is not secure server-side licensing.** Verification runs
on the customer's machine in code they can read and modify, so a determined
user can patch it out. Signature verification raises the effort required; it
cannot make the check authoritative. Only a server that holds licence state
and refuses service can do that. The Admin UI states this plainly rather than
implying otherwise.

### Connecting a real licence server

Set `VITE_LICENSE_API_URL` at build time. `createValidator()` then returns the
remote validator instead of the offline one - the service, storage shape and UI
are untouched. The expected request/response contract is documented in
`src/services/license/README.md`.

If the server is unreachable, activation falls back to the offline signature
check, so a genuine key still activates while the connection is down. A forged
key still fails.

### Offline policy

Once activated, the licence stays active offline **indefinitely** until
explicitly deactivated. This is deliberate for a POS: a till must never stop
trading because the internet is down. A failed re-verification caused by a
network problem never deactivates a working terminal; only a key that fails
signature verification outright is marked invalid.

## Admin panel

**Admin** is a single screen with nine sections in a keyboard-navigable rail
(arrow keys, Home/End). The open section is remembered for the session.

| Section | Contents |
| --- | --- |
| Dashboard | Today's sales and orders, items available, stock alerts, links to each screen |
| Menu / Inventory / Deals | Live counts plus a link to the dedicated screen |
| Restaurant Profile | The Step 5 profile form |
| Printer | Default paper width (58mm / 80mm) and direct-printing capability |
| Security | Change admin username and password |
| License | Local licence record |
| Settings | Order number prefix, default low stock level, receipt behaviour |

Menu, Inventory and Deals already own full screens, so Admin **links to them
rather than duplicating the UI** - one implementation each, no risk of two
copies drifting apart.

### Security

Changing the username or password always requires the **current password**, so
an unlocked terminal alone is not enough to take over the account. Passwords
are validated for length and confirmation, hashed with the existing PBKDF2
path, and cleared from component state after saving. The active session is
updated in place, so changing the username does not sign the operator out.

### Settings actually take effect

Nothing here is a dead switch:

- **Order number prefix** is applied by `orderService` to every new order
  number (`A-0001`).
- **Default low stock level** pre-fills the alert field when adding inventory.
- **Show receipt after completing an order** is honoured by the POS.
- **Paper width** is the default every new receipt opens with.

### License - honest scope

There is **no licence server and no validation**. A key entered here is stored
locally and reported as *unverified*; it does not activate or unlock anything.
The UI states this plainly. The record exists so a real activation check can
be added later without changing the storage shape.

## Sales analytics

The **Sales** section reports what was actually sold. Every figure is derived
from `sales` records written when an order was completed - nothing is
estimated, projected or invented. With no orders, every total is `Rs. 0` and
every count is `0`, and the page shows an empty state rather than a zeroed
dashboard.

### Periods

Calendar-based, computed in local time so "today" matches the operator's day:

| Period | Range |
| --- | --- |
| Today | The current local calendar day |
| This week | **Monday** to today |
| This month | The 1st to today |

Because weeks start on Monday, the weekly total can legitimately exceed the
monthly total in the first days of a month - the week reaches back into the
previous one. This is correct, not a bug.

Refunded sales (`refundedAt` set) are excluded from every figure. Averages
guard the division, so no orders yields `0`, never `NaN`.

### Visualisation

One lightweight bar chart of the current week, drawn with plain CSS - seven
values do not justify a charting dependency, so the runtime stays at three
packages. Days with no sales render an empty track rather than being omitted,
and any day with real sales gets a minimum bar height so a small figure is
never mistaken for an empty day.

## POS billing

The **POS** screen is the billing workflow. Every priced variant (size or
drink volume) is its own button, so selecting an item and its variant and
adding it to the cart is one tap. Adding the same item and variant again
stacks the line instead of duplicating it; a different variant becomes its own
line.

The cart supports quantity steppers, per-line removal and Clear, and shows
**Subtotal**, an optional **Discount** and **Total** (plus a tax row when a
rate is configured). The **Discount** field takes a rupee amount that reduces
the payable total the moment it is typed; values above the subtotal are
flagged ("Discount cannot exceed ...") and block completion, so the total can
never go negative. The footer also captures the **Customer paid** amount and
calculates **Return / Change** immediately as it is typed: an empty field
means the customer pays the exact total, an overpayment shows the change due,
and an underpayment blocks completion with a "Short by ..." hint until it is
covered — with or without a discount applied.

The payment method is chosen with one radio — **Cash**, **Card** or
**Digital Payment** (default Cash). It is stored on the order and sale, shown
on the receipt ("Payment method"), and listed next to each order on the Sales
screen. The paid and return figures are stored on the order and shown on the
confirmation and receipt. Completing an order writes it permanently and shows
the order ID.

### Money

All money is integer **paisa**; rupee floats never enter the arithmetic.
Display goes through one formatter, so the currency is Pakistani Rupees only:
`Rs. 500`, `Rs. 1,250.50`. Tax is rounded once, at the tax figure, to avoid
per-line drift. Exclusive tax is added on top; inclusive tax is extracted from
the price so the total still equals the sum of the displayed prices.

Tax comes from **Admin > Restaurant** (`Sales tax (%)` and `Prices include
tax`). It starts at **0**, so no rate is ever invented — with no tax
configured, total equals subtotal.

### What a completed order writes

One `orders` header, one `orderItems` row per line, and one `sales` row for
reporting — all in a **single atomic transaction**, so a failure can never
leave a half-recorded sale. Item names and sizes are denormalised onto the
order items, so a receipt still reads correctly if the menu item is later
renamed or repriced.

Order IDs are UUIDs; order **numbers** are a zero-padded per-installation
sequence (`0001`, `0002`, ...) backed by a counter in `settings`, so they
continue correctly across restarts.

Linked stock is decremented in the **same transaction** as the order, by the
quantity sold — deal lines deduct their included products multiplied by the
bundle quantity — so a completed sale can never skip its stock movement and a
failed checkout can never perform one. Quantities are clamped at zero, so
stock never goes negative and a stock write can never fail the payment; an
item that reaches zero is marked out of stock and disappears from the POS.

### Offline

Billing reads locally stored menu data and writes to IndexedDB. **No network
is involved** — verified by completing an order with the browser forced
offline.

## Printing

Two genuinely different paths, deliberately not conflated:

| | Browser print | ESC/POS direct |
| --- | --- | --- |
| Route | OS print dialog then printer driver | Bytes straight to the device |
| Code | `printService.ts` + `styles/print.css` | `escpos.ts` + `printerService.ts` |
| Works in | Every browser | Chromium (WebUSB / Web Serial) |
| Scaling | Browser and driver may rescale | None; printer renders the bytes |

**Browser printing is not equivalent to native ESC/POS communication.** It
renders a page and hands it to the operating system, which depends on the user
selecting the right printer and paper. ESC/POS sends commands with no dialog,
no driver rasterisation and no scaling.

### Print stylesheet

`src/styles/print.css` strips every top-level subtree except the receipt with
`display: none` (not `visibility`), so no empty leading page is produced.
`printService` moves the receipt to be a direct child of `<body>` while
printing, so no scrollable ancestor can clip a long receipt.

**Page size:** `@page` is injected at print time with **two explicit lengths**,
e.g. `@page { size: 58mm 97mm; margin: 0 }`. `size: 58mm auto` looks correct
but is invalid CSS and browsers silently drop the whole descriptor, leaving
the job on a Letter sheet with the receipt stranded in a corner. The height is
measured from the rendered receipt, so the roll is exactly as long as the
content and no trailing blank page is fed.

**Print Both** prints two genuinely separate pages in one job: page 1 is the
customer receipt, page 2 is the kitchen receipt. The customer clone carries a
real `break-after: page` (plus the legacy `page-break-after: always`), and the
`@page` height is sized to the **tallest single receipt** rather than the
stack, so the browser puts each receipt on its own physical page instead of
fitting both onto one sheet — no squashing, no duplicated or missing content,
and no third or blank page. Customer-only and Kitchen-only prints are
unchanged: one receipt, one page, sized to its content.

### ESC/POS

`escpos.ts` lays text into the printer's fixed character grid: **32 columns at
58mm, 48 at 80mm** (Font A). Amount columns are fixed width so a long product
name can never push the total off the paper, over-long words are hard-split
rather than dropped, and non-ASCII characters are transliterated because
thermal printers use a single-byte code page.

`printerService.ts` implements WebUSB and Web Serial transports behind one
interface, so another transport (Bluetooth, a native bridge) can be added
without touching the encoder.

**Not verified against hardware.** No thermal printer exists in the
development environment, so the transport code is unexercised end to end. The
byte encoding is unit-tested, and the printer panel can display and download
the exact byte stream for checking against a real device.

## Receipts

Completing an order opens its receipt. The layout is a dedicated thermal
format supporting **58mm** and **80mm** paper, switchable from the receipt
toolbar; the chosen width is saved as the default for the next receipt.

A receipt prints the restaurant name, logo, address, phone, email and receipt
info (each omitted entirely when not configured), the order ID, date and time,
every line with its size, quantity, unit price and amount, the subtotal, an
optional discount row (only when a discount was applied), deal savings and
tax where applicable, the total, the payment method, the amount paid and the
change due, and the configured footer.

### How the layout is kept from breaking

- The sheet is a **fixed physical width** (58mm / 80mm) and nothing inside may
  exceed it.
- Items use a four-column grid: one flexible name column plus **fixed** qty,
  price and amount columns. Amount columns never shrink, so a long product
  name can never squeeze the total off the paper.
- Every text cell uses `overflow-wrap: anywhere`, so long names and emails
  wrap rather than clip or overflow.
- Numeric columns are `white-space: nowrap`, so "Qty" and multi-digit
  quantities never split across lines.
- Optional rows are omitted rather than rendered blank, so nothing leaves a
  gap.

Printing hides all app chrome and removes page margins, so only the receipt
reaches the paper at its true width. Thermal-printer integration is
deliberately **not** part of this step.

## Deals

The **Deals** section bundles menu products at a better price. Nothing is
seeded: no example deals, no fake prices. A fresh install shows "No deals yet"
and a new deal form is completely empty.

A deal has a name, description, optional image, a set of included products
(each at a chosen size and quantity), and a **Published** switch.

### Pricing

Two pricing modes, chosen per deal:

| Mode | Behaviour |
| --- | --- |
| Fixed | You set the bundle price; that is what the customer pays |
| Percentage | A discount off the sum of the included products |

Percentage discounts are rounded **once**, at the end, so no per-line rounding
drift accumulates. Only the field belonging to the selected mode is stored, so
a stale value from the other mode can never be applied by accident. The form
shows a live preview of items total, deal price and customer saving, all in
Pakistani Rupees.

### Publishing

`isPublished` is the single control asked for by "enable/disable" and
"publish/unpublish": published deals appear in the POS, unpublished deals stay
saved and editable but are never sellable. The POS additionally withholds any
deal whose included products no longer resolve to a real price, so a deal that
cannot be fulfilled is never offered.

Deals appear in their own section above the individual items in the POS, and
add to the cart as a single priced line. Deals are recorded on the order with
a `dealId`, and completing the order also decrements linked stock for their
included products (contents × bundle quantity, aggregated by menu item) in
the same transaction as everything else.

## Inventory management

The **Inventory** section tracks stock. Lines are standalone, so anything can
be tracked (flour, cups, gas cylinders), and each may **optionally be linked**
to a menu item. Entering a stock-line name that exactly matches a single menu
item pre-selects that link for you — a manual choice is never overridden —
and the field's hint explains what the link does. Nothing is seeded: a fresh
install has zero stock lines and shows "No inventory items yet".

### Status

Status is derived, never stored twice:

| Status | Condition |
| --- | --- |
| Out of stock | Marked out of stock, or quantity is zero |
| Unavailable | Availability switched off (quantity untouched) |
| Low stock | Quantity at or below the low-stock alert |
| In stock | Everything else |

`isAvailable` and `isOutOfStock` are deliberately separate from `quantity`:
switching an item unavailable does not destroy its count, and marking it out of
stock remembers the previous quantity in `quantityBeforeOutOfStock` so
**Restore** can bring it back exactly.

### Effect on the POS

A linked line that is out of stock or unavailable **withholds its menu item
from the POS**, so staff cannot sell what is not there. `useInventory` notifies
menu subscribers as well as its own, so the POS updates the moment stock
changes — no reload.

Destructive actions (delete, mark out of stock) require inline confirmation.

## Menu management

The **Menu** section (5th nav item) manages what the POS can sell. Nothing is
seeded: no default products, no demo items, no sample prices. A fresh install
shows "No menu items yet".

Each item supports a name, category, description, image, an availability
toggle, and a variant selector: **Food sizes** (Small, Medium, Large, Extra
Large, XL) or **Cold drink volume** for beverages. Food sizes are the fixed
predefined set; volumes combine the predefined starting points (250 ml, 330
ml, 500 ml / Half Liter, 1 Liter, 1.5 Liter) with a **custom volume row** —
enter any value and unit (`Volume [350] Unit [ml] Price [100]` gives
"350 ml", `Volume [2] Unit [L] Price [300]` gives "2 Liter") and it becomes a
normal stored label like any other. Custom volumes are never restricted to a
hardcoded list: they round-trip through Add/Edit, appear as their own buttons
in the Menu list and POS, and flow through the cart, orders and both
receipts. Both kinds use the same variant/price rows, so nothing about
storage or sale flow differs. Every price is optional — leave a size or
volume blank and the item simply is not sold in it. Prices are entered and
displayed in Pakistani Rupees only, and stored as integer paisa so no
floating-point drift is possible.

### Storage shape

An item is one `menuItems` record plus one `itemPrices` row per offered
variant. Keeping prices in their own store means new labels, cost prices or
per-size stock can be added without reshaping the item record. Deleting an
item removes it and its price rows in a **single atomic transaction**, so
orphaned prices cannot be left behind.

### Live updates to the POS

`src/hooks/useMenu.ts` is a small publish/subscribe store over the database.
Saving, toggling or deleting an item notifies every mounted consumer, so the
POS reflects the change immediately without a reload or a state library. The
POS subscribes with `activeOnly`, so disabled items are never sellable while
remaining saved and editable in Menu.

## Restaurant profile

Configured from **Admin > Restaurant**. One profile record per terminal, saved
under the fixed key `restaurant-profile` in the `restaurant` store.

Editable fields: restaurant name, logo, address, phone, email, receipt
information and receipt footer message. **Every field starts empty** — no
example name, address, phone number or logo is ever shipped or written. The
record itself is not created until the operator saves for the first time.

### Logo handling

Logos are optimised in the browser before they are stored, so a multi-megabyte
photo becomes a few kilobytes:

- Downscaled so the longest edge is at most **512px**.
- Re-encoded as **WebP** (quality 0.86) with a PNG fallback; the smaller of the
  two wins.
- Transparency is preserved — no white matte is painted behind the image.
- SVGs are passed through untouched since vector data is already compact.
- Files over 8 MB are rejected before decoding.

The result is stored as a data URL inside the profile record, so the profile is
one self-contained row with no separate blob store to keep in sync.

## Authentication

Admin sign-in gates the entire application; every route except `/login` is
wrapped in `RequireAuth`.

**Credentials are configurable.** `VITE_ADMIN_USERNAME` / `VITE_ADMIN_PASSWORD`
in `.env` seed the account on first run only. After that the credentials live
in the local database and are changed at runtime via
`authService.changeCredentials()` — editing `.env` later will not reset a live
account. `.env` is git-ignored; `.env.example` documents the format.

**Passwords are never stored in plaintext.** They are hashed with PBKDF2-SHA256
(150,000 iterations, per-account random salt) via the Web Crypto API, and
verified with a constant-time comparison. Only the hash, salt and parameters
are persisted.

**Sessions** hold an opaque random token, the username and an expiry — no
credential material. They live in localStorage so a refresh or terminal restart
keeps the operator signed in, and expire after 12 hours.

**Hardening.** Login failures always return one generic message so the response
cannot be used to enumerate usernames; both the username and password checks
always run so timing cannot reveal which failed; five consecutive failures
trigger a one-minute lockout.

## Key decisions

**Version** — `1.1.0` in `package.json`, `src/config/app.config.ts` and `public/sw.js`.

**Currency** — Pakistani Rupees only. Money is stored as **integer paisa** to avoid
floating-point drift and formatted through `formatMoney()` so `Rs.` is never
hard-coded in the UI. `parseMoney()` accepts `Rs. 1,250.50`, `1,250`, `PKR 300`.

**Routing** — `src/app/routes.tsx` is the single registry. Pages are lazy-loaded
and code-split; the sidebar and mobile tab bar are generated from `NAV_ITEMS`,
so navigation can never drift out of sync with the router. The four sections are
POS (`/`), Sales (`/sales`), Inventory (`/inventory`) and Admin (`/admin`).

**Storage** — IndexedDB is the system of record, ready for offline-first. Every
record carries `createdAt` / `updatedAt` / `deletedAt` / `rev`, deletes are soft
by default, and an `outbox` store is already provisioned to queue mutations for a
future sync engine. New domains need one entry in `STORE_SCHEMAS` plus one line
in the repository registry.

**Styling** — White surfaces on a warm beige/cream background, espresso ink for
text, and a restrained bronze accent used only for active markers and focus.
Warm neutrals throughout — no cool greys. All colour, spacing, type, radius,
elevation, z-index and layout values live in `src/styles/tokens.css`; components
use CSS Modules and reference tokens only.

**Motion** — Short, purposeful transitions: a 320ms page fade-and-rise, a
growing bar on the active nav item, hover/focus fades on every control, and a
scale-down on button press. All of it collapses under
`prefers-reduced-motion: reduce`.

**Responsive** — Desktop (≥1024px) full sidebar with labels · Tablet
(640–1023px) compact icon rail · Mobile (<640px) bottom tab bar carrying all
four sections. Touch targets are 44px minimum, inputs use 16px text to avoid iOS
zoom-on-focus, and safe-area insets are respected.

**PWA** — Manifest, icons (incl. maskable), theme colour and an app-shell service
worker are in place. The worker is registered in production builds only so dev
hot reload is unaffected.

**No chrome** — There is no global header, no footer, no marketing sections and
no dashboard widgets. Navigation is the only persistent UI; each screen renders
its own `PageHeader`. The offline banner appears only when the connection drops.
Because all four sections fit in the mobile tab bar, there is no hamburger menu
or drawer either.

**No invented data** — Every section is a professional empty state. The only
figures shown anywhere are genuine runtime facts on the Admin screen (version,
currency, locale, database name/version, storage availability, connection).

## Verified

Checked in a real headless browser at 1440x900, 834x1112 and 390x844:

- `npm run build` — passes, zero TypeScript errors (strict, `noUncheckedIndexedAccess`).
- All routes render with no console errors, page errors or horizontal overflow.
- Sidebar/rail/tab-bar appear at the correct breakpoints; exactly one nav item
  is marked active per route.
- Navigation, the empty-state CTA, hover states, and input focus rings all work.
- Mobile tab targets are ≥44px tall.
- **All text meets WCAG AA contrast (4.5:1)** on every surface in the palette.

Authentication (39 automated browser assertions):

- Correct login, incorrect password, unknown username, and empty submit.
- Logout from both the sidebar and the Admin screen, on desktop and mobile.
- All four routes redirect to `/login` when unauthenticated, and remain blocked
  after logout.
- Refresh, hard reload on a deep route, and re-visiting `/login` while signed in.
- Redirect back to the originally requested route after signing in.
- Lockout after repeated failures, including refusing the correct password while locked.
- No plaintext password in the DOM, in localStorage, or in IndexedDB.
- Credential changes: wrong current password and too-short passwords rejected;
  username and password changes apply and invalidate the old password.

Local database (27 persistence assertions + 6 migration assertions, run against
a persistent on-disk browser profile so the browser is genuinely restarted):

- Database opens at v2 with all 12 stores, each keyed by a stable `id`.
- Database starts empty: zero records in every business store, and the admin
  store is empty until the first sign-in creates exactly one account.
- A record written to every one of the 12 stores survives a **full browser
  restart**, not just a refresh — values, nested objects and `createdAt` intact.
- `update()` preserves `createdAt`, advances `updatedAt`, increments `rev`,
  and the change survives a reload.
- Unique indexes enforced (duplicate order number rejected); index lookups
  return linked rows; multi-store transactions commit atomically.
- Soft delete hides a row from `list()` while retaining it for sync.
- A genuine v1 database upgrades to v2 automatically, drops the retired
  `products`/`categories`/`outbox` stores, and preserves pre-existing data.
- Reset clears business data while preserving the admin account.

Restaurant profile (54 assertions, persistent on-disk browser profile):

- All seven fields start empty on a fresh install; no restaurant record exists
  until the first save; the rendered form contains no fake name, phone,
  address or email.
- Name is required and an invalid email is rejected; nothing is persisted while
  the form is invalid.
- A 138 KB test image was stored at 34.8 KB as WebP; a 900px image was
  downscaled to 512px with its alpha channel intact; an SVG stayed vector.
- Every field, including the logo, reloads correctly after a **full browser
  restart**, and again after a second restart.
- Editing updates the single record in place (no duplicate), preserves
  `createdAt`, advances `updatedAt` and increments `rev`.
- Discard reverts to the last saved values; removing the logo persists as null
  without disturbing the other fields.
- No horizontal overflow at 1440px, 834px or 390px; all text meets WCAG AA.

Menu management (69 assertions, persistent on-disk browser profile):

- Fresh install shows "No menu items yet" with an "Add Item" action and zero
  item/price rows in the database; the add form's fields are all empty and
  contain no example product name or price.
- Name is required; nothing is saved while invalid; the price field rejects
  letters and accepts two decimals.
- Prices round-trip as integer paisa (250.50 -> 25050) and render as "Rs. ...".
- A 120 KB photo was stored at 28.5 KB as WebP, downscaled to 400px.
- Items, prices and images survive a **full browser restart**, twice.
- Editing loads the real saved values, updates in place without duplicating,
  preserves `createdAt`, and clearing a size deletes just that price row.
- Disabling hides an item from the POS while keeping it in Menu; re-enabling
  restores it. Deleting asks for confirmation, can be cancelled, and leaves no
  orphaned price rows.
- New and changed items appear in the POS immediately, with no reload.
- The availability switch is keyboard focusable and togglable with Space.
- No horizontal overflow at 1440 / 834 / 390 px; all five nav sections
  reachable; WCAG AA across every new screen and state.

Inventory management (58 assertions + 6 migration assertions):

- Fresh install is completely empty: zero stock rows, "No inventory items yet",
  and the add form shows a blank quantity rather than a fabricated 0.
- Name and quantity are required; negative values and letters are blocked;
  nothing is written while the form is invalid.
- Standalone and menu-linked lines both save, with unit, SKU and low-stock
  alert, and survive **two full browser restarts**.
- The quantity stepper persists increases and decreases and is keyboard
  operable.
- Mark out of stock asks for confirmation, zeroes the quantity, remembers the
  previous figure, and **Restore** brings back exactly that figure.
- Turning availability off withholds the item without touching its quantity.
- A linked item that is out of stock or unavailable disappears from the POS and
  returns when restored.
- Delete asks for confirmation and can be cancelled.
- A genuine v2 database upgrades to v3, gains the new index, and keeps its
  existing rows intact.
- No horizontal overflow at 1440 / 834 / 390 px; WCAG AA across every state.

POS billing (71 assertions, persistent on-disk browser profile):

- Totals verified directly against the calculator: exact paisa sums, exclusive
  tax added on top, inclusive tax extracted with the total unchanged, integer
  rounding, and zero for an empty cart.
- Select item, select size, add to cart; same item+size stacks into one line
  while a different size becomes its own line; multiple products at once.
- Quantity increment/decrement update totals; stepping to zero removes the
  line; remove and Clear work; Complete is disabled on an empty cart.
- A four-unit, two-product order completed to `Rs. 900.50` and persisted with
  correct subtotal, quantities and line totals across `orders`, `orderItems`
  and `sales`.
- Order IDs are unique and order numbers are sequential (`0001`, `0002`, ...),
  continuing correctly after a **full browser restart**.
- A 16% tax rate set in Admin produced `Rs. 400 + Rs. 64 = Rs. 464` and
  persisted exactly.
- Completing an order deducted linked stock (5 -> 3 -> 0), auto-marked the line
  out of stock, and removed the item from the POS.
- An order was completed with the browser **forced offline** and persisted.
- Prices render only as `Rs.`; no other currency symbol appears anywhere.
- Keyboard operable end to end; WCAG AA on every state; no overflow at
  1440 / 834 / 390 px.

Deals (84 assertions + 7 migration assertions, persistent browser profile):

- Pricing verified directly: items total from live menu prices, fixed price
  used as-is, percentage applied and rounded to integer paisa, savings
  computed, and a deal containing an unpriced size flagged not sellable.
- Fresh install has zero deals; the create form is entirely empty with no
  example name, price, product or image, and defaults to unpublished.
- Name, at least one product, and a price/percentage are all required;
  nothing is written while invalid.
- Create: two products totalling `Rs. 570` bundled at `Rs. 500`, live preview
  showing `Customer saves Rs. 70`, persisted as 50000 paisa.
- Publish: the deal appears in the POS with its price, original total struck
  through, and the saving. Unpublish removes it from the POS while keeping it
  saved.
- Add to order: a published deal added to the cart at its deal price, stacked
  on repeat, mixed with a normal item (`Rs. 1,080`), and completed — recorded
  as its own order line carrying `dealId` rather than `menuItemId`.
- Edit: switching fixed -> 25% recalculated to `Rs. 427.50`, cleared the stale
  fixed price, preserved `createdAt` and incremented `rev`, with no duplicate.
- Delete: confirmation required and cancellable; deleting a deal leaves past
  order lines intact.
- Everything survived two **full browser restarts**.
- A genuine v3 database upgraded to v4, dropped the stale `by_isActive` index,
  created `by_isPublished`, and preserved its existing deal.
- Keyboard operable (publish switch and deal tiles); WCAG AA on eight states;
  no overflow at 1440 / 834 / 390 px.

Receipts (137 assertions, driven through the real POS UI on both widths):

- Every required field renders: restaurant name, address, phone, email,
  receipt info, order ID, date, time, item, size, quantity, unit price,
  subtotal, deal savings, total and footer. Currency is `Rs.` only.
- Optional fields are omitted cleanly when unconfigured, with no blank gaps.
- Scenarios covered at **both 58mm and 80mm**: 1 item, 5 items, 12 items,
  very long item names (67-character single word), multiple sizes of one
  product, large quantities, deals, and a 74-character restaurant name with a
  logo and a long footer.
- For every scenario the suite asserts: the sheet is exactly 58mm/80mm, the
  content does not overflow it, **no element renders outside the paper**, no
  element clips its own text, the page never scrolls sideways, the TOTAL is
  present, all item lines are rendered, and there is no excess trailing space.
- Deal lines are flagged `DEAL`, itemised with their contents, and their
  savings are shown and totalled.
- The width toggle switches live, is keyboard operable, exposes `aria-pressed`,
  and persists as the default.
- Print media hides the app chrome and leaves the receipt visible.
- WCAG AA on the receipt view; no overflow at 1440 / 834 / 390 px.

Thermal printing (Step 11):

- ESC/POS encoder unit-tested: 32/48 column widths, word wrap, hard-splitting
  of over-long words with nothing lost, two-column lines padded to exactly the
  paper width with the amount preserved when the label is too long, ASCII byte
  values, and non-ASCII transliteration.
- Byte stream structure verified: starts with `ESC @`, uses bold and centre
  alignment, ends with feed + partial cut.
- **Real PDFs generated through the browser print path** for short, long
  (15 items), long-product-name, multi-size and deal receipts at both widths,
  then inspected with pypdf: every page is exactly 58mm (163.9pt) or 80mm
  (227pt) wide, single page, no blank pages, TOTAL present, and no text
  extending beyond the paper.
- Printer panel reports WebUSB / Web Serial / secure-context availability
  honestly, disables sending with no printer connected, and fails loudly
  rather than silently when asked to print without a connection.
- WCAG AA on the receipt view, printer panel and output preview; print
  controls are excluded from the printed page.

A real defect was found and fixed during this phase: `@page { size: 58mm auto }`
was silently dropped by the browser, so every print job used a Letter sheet.
Confirmed via the CSSOM and fixed by emitting two explicit lengths.

Sales analytics (44 assertions):

- With no sales: today/week/month totals and order counts are all 0, the
  average is 0 rather than NaN, the week chart still renders 7 days, and the
  page shows an empty state instead of zeroed cards.
- Period arithmetic verified against deliberately seeded records spanning
  today, the week start, the day before the week start, the month start and
  the day before it: each period sums exactly the rows inside its bounds and
  excludes the rest.
- Week boundaries verified directly: a Wednesday and the following Sunday both
  resolve to the same Monday, and the next Monday starts a new week.
- Refunded sales are excluded from totals and counts.
- Rendered figures match the service exactly, in `Rs.` only.
- Completing a real order raises today's total by exactly the order total and
  the count by one, live.
- WCAG AA with data and empty; no overflow at 1440 / 834 / 390 px.

Admin panel (54 assertions):

- All nine sections present, exactly nine, with no extra header/footer chrome.
- Dashboard shows real figures (Rs. 0 on an empty install, never invented).
- Menu/Inventory/Deals sections link out rather than duplicating their UI.
- Printer: both widths offered with their column counts; the selection
  persists to the database and survives a **full browser restart**.
- License: starts unlicensed, states plainly that it is not verified, and a
  saved key persists across a restart.
- Settings: prefix, low stock default and receipt behaviour all persist across
  a restart **and are verified to take effect** - a completed order was
  numbered `A-0001`, the receipt step was skipped when turned off and returned
  when turned on, and the inventory form pre-filled the configured level.
- Security: wrong current password, mismatched confirmation and too-short
  passwords are all rejected with nothing written; changing both username and
  password succeeded, the **old credentials then failed and the new ones
  signed in**, and the fields were cleared after saving.
- Arrow-key navigation between sections; WCAG AA on all nine; no overflow at
  1440 / 834 / 390 px.

Licence system (48 assertions):

- Initial state is **NOT ACTIVATED**; the UI states the validation method,
  that no licence server is configured, the offline policy, and that a
  client-side check is not secure server-side licensing.
- Invalid flows all rejected with specific messages and **no state written**:
  gibberish, a key signed by a different private key (forged), a tampered
  genuine key, a genuinely-signed but expired key, and an unsupported version.
- A valid key activates, showing licence ID, holder, plan, dates and method,
  with the key **masked** rather than printed in full.
- Activation survives a **full browser restart**, twice.
- Stays ACTIVATED while offline, and an offline re-verify does not deactivate.
- A stored key corrupted directly in the database is caught on re-verify and
  marked INVALID; reactivating with the genuine key restores it.
- Deactivation requires confirmation, is cancellable, and clears the key and
  all licence details.
- Validator unit checks map each failure to the right reason code.
- WCAG AA in both states; no overflow at 1440 / 834 / 390 px.

Offline-first (46 assertions, network requests hard-aborted):

- Verified with the context offline **and** a route handler aborting every
  request, so any hidden network dependency fails loudly. 12 blocked attempts
  were recorded; none were required.
- Offline: the application opens, login works, and POS, Menu, Inventory,
  Deals, Sales and Admin all load - including routes never opened while
  online.
- Offline: menu, inventory, deals, restaurant settings, printer settings and
  an ACTIVATED licence are all available.
- Offline: an order with items and a deal totalled `Rs. 2,530`, completed and
  saved, produced a receipt at both 58mm and 80mm, and generated 930 bytes of
  ESC/POS output.
- **The application was then closed and reopened, still offline:** the order
  existed, sales showed `Rs. 2,530` from 1 order, stock had been deducted
  20 -> 18, and menu, inventory and deals were all intact.
- A second offline order saved with a unique number and the daily total
  accumulated correctly.
- Back online, both offline orders and their totals were still present.

Synchronisation (41 assertions, against a real mock backend):

- A mock server (`scripts/mock-sync-server.mjs`, test-only) implements the
  documented contract with fault injection, so sync is proven end to end
  rather than assumed.
- Offline: status reads **Offline**, three orders saved locally, six changes
  queued, and **no orders reached the backend**.
- Reconnect: the queue drained, status became **Synced**, all three orders
  arrived with matching totals, items and sale records, and **no duplicates**.
- **Duplicate protection:** the server was made to commit and then drop the
  response. The client retried; the order count went 3 -> 4 and stayed at 4.
- **Retry/error:** a 500 surfaced as **Sync error** with the item retained and
  a Retry action; **an order was completed normally during the error**; the
  queue then drained fully with nothing lost.
- **Conflicts:** a server-won conflict was applied locally so config
  converged, while order records were untouched.
- **Bulk:** five offline orders synced with five unique ids and an empty queue.
- With sync disabled the indicator renders nothing and no errors occur.

Two real bugs were found and fixed during this phase: applying a server
conflict re-enqueued the change and looped sync forever, and the status
indicator reported `pending: 0` while work was actually queued.

PWA installation (45 assertions):

- Manifest valid and fetchable with name, short_name, standalone display,
  start_url, scope, theme and background colours, 192/512 icons, **maskable
  icons at both sizes**, and three app shortcuts. Every icon and every
  shortcut target was fetched and confirmed to resolve.
- Service worker active, one cache version, whole build precached.
- **Honesty rule verified**: no install button is rendered unless the browser
  reports it can prompt, and the reason is explained when it cannot.
- Simulated iOS Safari is reported as `MANUAL INSTALL`, given the real Share
  steps, and shown **no** install button.
- Standalone: detected correctly, app renders, boot placeholder removed, and
  installService reports `installed`.
- **Offline relaunch**: the app bootstrapped, the previous order and sales
  total survived, the menu remained available, and **a new order was
  completed** - all with the network hard-aborted.
- No horizontal overflow at 1440 / 834 / 390 px in standalone; WCAG AA across
  every Admin section.

**Environment limitation, stated plainly:** the headless Chromium available
here never fires `beforeinstallprompt` - I verified this by serving a
textbook-minimal reference PWA alongside the POS and confirming *neither*
triggers it. The install prompt itself therefore could not be exercised
end-to-end; everything it depends on was verified instead. Chromium's `--app`
flag also yields `about:blank` in this build, so standalone was simulated
through the same display-mode query the application reads.

Settings, privacy and branding (50 assertions):

- Application information shows Version `1.1.0`, `Pakistani Rupees (Rs.)`,
  `PKR`, locale, time zone, local storage and provider.
- Privacy Policy renders with 10 correctly numbered sections covering what is
  stored, the absence of analytics, when data leaves the device, PBKDF2
  password hashing, retention and deletion, and contact.
- Terms & Regulations renders with 13 correctly numbered sections covering the
  licence, activation, operator responsibilities, tax and records, local
  storage risk, printing caveats, warranty disclaimer, liability limitation
  and governing law.
- Policy claims were checked against the running application: sync really is
  disabled by default, and a local database really is in use.
- **Branding containment verified**: the vendor name appears nowhere on POS,
  Sales, Menu, Deals, Inventory or the login screen, and a printed receipt
  shows the restaurant's name rather than the vendor's.
- Settings cross-links to About; WCAG AA on all three views; no overflow at
  1440 / 834 / 390 px.

Security and data-integrity audit (Step 19):

**12 issues found and fixed.**

| Severity | Issue | Fix |
| --- | --- | --- |
| HIGH | Admin password shipped in the JS bundle | Random one-time setup password; no secret in the build |
| HIGH | Forged `localStorage` session granted admin access | Session token bound to a hash on the account record |
| HIGH | Negative price accepted -> negative order total | `assertPaisa` rejects at the service boundary |
| HIGH | Negative quantity accepted -> negative total | `assertQuantity` requires >= 1 |
| HIGH | Float price produced non-integer paisa | Rounded to integer paisa |
| HIGH | `NaN` price accepted -> order total `NaN` | Rejected; aggregation also made defensive |
| HIGH | One bad order made the day's sales total `null` | Non-finite values treated as zero when summing |
| HIGH | `NaN` stock quantity persisted | `clampStock` converts to 0 |
| HIGH | `NaN` menu price persisted | `sanitisePrice` converts to `null` |
| MED | Zero-quantity line accepted | Rejected |
| MED | `Infinity` price accepted | Rejected |
| MED | Absurd quantity (1e9) accepted | Bounded |

Verified after the fixes: forged, expired and wrong-user sessions are all
rejected; lockout still triggers after repeated failures; junk, empty and
unsigned licence keys are rejected; admin credentials are stored as
PBKDF2-SHA256 with a 150,000-iteration salt and no plaintext; queued sync
payloads carry no password, salt, session token or licence key; and every
destructive action confirms.

Usability was explicitly checked - a normal order still completes in ~0.6s and
all form validation behaves as before.

UI and performance audit (Step 20):

Measured before changing anything, then re-measured after. Six issues found
and fixed:

| Area | Issue | Fix |
| --- | --- | --- |
| Motion | Sales chart animated `height`, forcing layout per frame | Composited `scaleY` keyframe |
| Motion | Sidebar active marker animated `height` | Composited `scaleY` from centre |
| Touch | Cart controls were 36px on touch (44px is the guideline) | Expanded hit area via pseudo-element |
| Dead code | `data/storage/localStorage.ts` unreferenced | Removed |
| Dead code | `hooks/useMediaQuery.ts` unreferenced | Removed |
| Tokens | `taupe-400` was darker than `taupe-500` after the Step 8 contrast fix | Scale reordered; rendered colours unchanged |

Verified after the fixes: 35/35 checks passed - every screen renders in under
200ms with a realistic dataset, an order completes in 541ms, zero dropped
frames, no layout-thrashing transitions remain, WCAG AA holds on all six
screens, and there is no horizontal overflow at 1440 / 834 / 390 px.

Confirmed already clean and left alone: 6 font sizes on one family, 4 border
radii, no fake or demo content, no unnecessary header or footer, all five
empty states have a heading and an action, validation messages are visible,
and no runtime dependency is unused (react, react-dom, react-router-dom).
