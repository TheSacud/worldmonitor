# WorldMonitor Architecture Baseline

Reviewed: 2026-07-06

This baseline is the worker-facing map of the WorldMonitor application. It is
meant to reduce repeated source exploration before small PRs. For deeper system
details, keep using the root [`ARCHITECTURE.md`](../ARCHITECTURE.md) as the
maintainer reference and [`docs/architecture.mdx`](architecture.mdx) for design
philosophy and public documentation.

## Verification Notes

- Codebase-memory MCP lookup was attempted first with project
  `home-hermes-workspaces-worldmonitor`, but that project was not indexed in the
  available MCP cache. The claims below were verified against repository files in
  this worktree.
- This review avoided secret files, local `.env` files, runtime databases, logs,
  and private state.
- Dynamic counts should come from [`docs/generated/stats.json`](generated/stats.json)
  and the `npm run docs:stats` / `npm run docs:check` guardrails, not hand edits.

## System Shape

WorldMonitor is a real-time global intelligence dashboard. The main product is a
Vite single-page app written in TypeScript, with vanilla DOM components, map
renderers, worker-backed analysis, Vercel Edge API endpoints, proto-backed domain
services, a Tauri desktop shell with a Node.js sidecar, and Railway-style seed
and relay services that publish cacheable data into Redis.

High-level request path:

```text
Browser or Tauri renderer
  -> Vite SPA entrypoint and panel/map runtime
  -> /api/* through Vercel Edge or desktop sidecar
  -> generated proto gateway or hand-written operational endpoint
  -> server/worldmonitor domain handler
  -> Redis cache and/or upstream provider
```

Seeded data path:

```text
Railway relay / cron seed scripts / consumer-prices service
  -> Redis cache key plus seed-meta:<key>
  -> /api/bootstrap and /api/health
  -> SPA hydration cache, panel loaders, map layers, freshness badges
```

## Entrypoints

| Surface | Entrypoint | Role |
| --- | --- | --- |
| Web SPA | [`src/main.ts`](../src/main.ts) | Imports global CSS and bootstrap shims, installs deferred Sentry/web-vitals reporting, then creates the app shell. |
| App shell | [`src/App.ts`](../src/App.ts) | Owns startup phases, runtime state, layout managers, data fan-out, deep links, auth/session setup, and refresh registration. |
| Dashboard HTML | [`index.html`](../index.html), [`vite.config.ts`](../vite.config.ts), [`vercel.json`](../vercel.json) | Vite builds the dashboard entry from `index.html`, renames the emitted asset to `dashboard.html`, and Vercel rewrites most non-API routes to it; root marketing/pro routes are handled separately. |
| Embed widget | [`embed.html`](../embed.html), [`src/embed-main.ts`](../src/embed-main.ts) | Embeddable widget surface with separate CSP/header treatment. |
| Vercel API | [`api/`](../api) | Edge endpoint entries. Proto domain entries are thin gateway wrappers; operational endpoints are hand-written. |
| Proto gateway | [`server/gateway.ts`](../server/gateway.ts), [`server/router.ts`](../server/router.ts) | Shared Edge request pipeline and generated route matching for domain RPCs. |
| Desktop shell | [`src-tauri/src/main.rs`](../src-tauri/src/main.rs) | Tauri lifecycle, trusted windows, keyring-backed secret cache, sidecar process control, IPC. |
| Desktop sidecar | [`src-tauri/sidecar/local-api-server.mjs`](../src-tauri/sidecar/local-api-server.mjs) | Local API server that loads bundled handlers, injects allowlisted secrets, applies request safety controls, and proxies renderer `/api/*` calls. |
| Relay / seed loops | [`scripts/ais-relay.cjs`](../scripts/ais-relay.cjs), [`scripts/seed-*.mjs`](../scripts) | Long-running relay and scheduled seeders for markets, aviation, risk, positive events, UCDP, OREF, and related datasets. |
| Consumer prices | [`consumer-prices-core/`](../consumer-prices-core) | Separate Node/TypeScript service for scraper, aggregate, and publish jobs. |
| Cloudflare worker | [`workers/api-cors-preflight/`](../workers/api-cors-preflight) | CORS preflight worker for `api.worldmonitor.app`. |

## Frontend Runtime

The browser app is framework-free TypeScript. `App` composes four main managers:

- [`PanelLayoutManager`](../src/app/panel-layout.ts) creates the map and panel
  grid, handles deferred panel mounting, panel order, premium gates, tabs,
  custom/MCP panels, and viewport-triggered hydration retries.
- [`DataLoaderManager`](../src/app/data-loader.ts) owns bulk and panel-specific
  loaders. `loadAllData()` serializes concurrent runs, deduplicates in-flight
  tasks, respects variant and viewport gates, consumes bootstrap hydration, and
  updates panels, map layers, search, and freshness state.
- [`RefreshScheduler`](../src/app/refresh-scheduler.ts) wraps
  `startSmartPollLoop()` with named refresh runners, tab visibility pause,
  in-flight protection, backoff, and staggered refresh after hidden tabs resume.
- [`EventHandlerManager`](../src/app/event-handlers.ts) wires controls, map layer
  actions, URL state, keyboard/search interactions, exports, and panel events.

The component model centers on [`Panel`](../src/components/Panel.ts). Panels
render HTML into stable containers, so handlers generally use event delegation
rather than listeners on replaced child nodes. Map rendering is split between
[`DeckGLMap`](../src/components/DeckGLMap.ts) for flat WebGL maps and
[`GlobeMap`](../src/components/GlobeMap.ts) for globe mode.

Web workers under [`src/workers/`](../src/workers) provide analysis, local ML,
and vector database work off the main thread. Browser-side persistent state uses
IndexedDB for heavier caches/snapshots and localStorage for user preferences.

## Variant System

`SITE_VARIANT` is resolved in [`src/config/variant.ts`](../src/config/variant.ts)
from `VITE_VARIANT`, hostname, desktop localStorage, or localhost localStorage.
The current supported variants are `full`, `tech`, `finance`, `commodity`,
`happy`, and `energy`.

Variant configuration lives primarily in:

- [`src/config/panels.ts`](../src/config/panels.ts) for default panel sets,
  premium flags, priorities, and map layer defaults.
- [`src/config/variants/`](../src/config/variants) for shared variant config
  exports and refresh/storage constants.
- [`src/config/map-layer-definitions.ts`](../src/config/map-layer-definitions.ts)
  for layer metadata, renderer support, premium flags, and variant filtering.

When changing a panel, map layer, or refresh cadence, verify both the default
variant config and any scheduler/data-loader gates that reference that panel or
layer.

## API And Service Boundary

There are two API families:

- Proto-backed domain APIs: `api/<domain>/v1/[rpc].ts` calls
  `createDomainGateway(create<Service>Routes(handler, serverOptions))`. The
  source imports generated server descriptors and `server/worldmonitor/**`
  handlers, then Vercel bundles each endpoint as an Edge function.
- Operational APIs: hand-written endpoints in [`api/`](../api) for bootstrap,
  health, auth/session, checkout, MCP, OAuth, notifications, downloads, content
  proxies, and legacy/raw passthroughs.

The gateway applies CORS, API key and entitlement checks, rate limiting, route
matching, compatibility handling, error mapping, ETags, cache headers, usage
telemetry, idempotency support where applicable, and response projection.

The proto contract flow is:

```text
proto/worldmonitor/**
  -> make generate
  -> src/generated/client/**
  -> src/generated/server/**
  -> docs/api/**
  -> api/<domain>/v1/[rpc].ts and server/worldmonitor/<domain>/v1/handler.ts
```

Generated files under [`src/generated/`](../src/generated) are not edited by
hand. Proto and OpenAPI freshness are guarded by CI and `make generate`.

## Data And State Boundaries

Redis is the main shared runtime boundary. Server handlers use
[`server/_shared/redis.ts`](../server/_shared/redis.ts), especially
`cachedFetchJson()`, for TTL caching, negative sentinels, short local fallbacks,
and cache-miss coalescing. Cache keys must include all request-varying inputs.

Bootstrap hydration is handled by [`api/bootstrap.js`](../api/bootstrap.js) and
[`src/services/bootstrap.ts`](../src/services/bootstrap.ts):

- The endpoint reads named Redis keys in a pipeline and returns `data` plus
  `missing` keys.
- The browser fetches fast and slow tiers, stores payloads in an in-memory
  consume-once hydration cache, and falls back to persistent browser cache when
  offline or when live bootstrap misses.
- The data loader consumes hydration entries before falling back to per-panel
  RPC calls.

Freshness health is handled by [`api/health.js`](../api/health.js), which reads
cache keys and matching `seed-meta:<key>` records to classify stale, empty,
warning, and critical states. Client freshness badges are refreshed through
[`src/services/health-freshness.ts`](../src/services/health-freshness.ts).

Desktop state boundaries:

- Tauri stores secrets in the platform keyring and exposes only allowlisted keys
  to the sidecar.
- The renderer's [`installRuntimeFetchPatch()`](../src/services/runtime.ts)
  intercepts app-origin `/api/*` requests, sends them to the local sidecar with
  a short-lived bearer token, and uses cloud fallback only when allowed.
- The sidecar loads API modules locally and has its own request safety,
  concurrency, and upstream fetch controls.

## Security And Trust Boundaries

Primary boundaries:

```text
Browser -> Vercel Edge -> Redis/upstream providers
Desktop renderer -> local sidecar -> Redis/upstream providers or cloud API
Relay/seed services -> Redis -> bootstrap/health/domain handlers
```

Key security surfaces:

- [`api/_cors.js`](../api/_cors.js) and [`server/cors.ts`](../server/cors.ts)
  maintain origin allowlists for Edge and server-bundled code.
- [`api/_api-key.js`](../api/_api-key.js) and gateway entitlement helpers gate
  API key, session, premium, and internal MCP access.
- [`middleware.ts`](../middleware.ts) filters automated traffic on API and asset
  paths while preserving social/AI crawler access to explicit public discovery
  routes.
- CSP is split across [`index.html`](../index.html), [`vercel.json`](../vercel.json),
  and [`src-tauri/tauri.conf.json`](../src-tauri/tauri.conf.json); changes must
  keep those surfaces aligned.
- RSS/content proxy endpoints use allowlists and request validation to avoid
  arbitrary fetches.

Do not commit `.env` files, credentials, runtime caches, local DBs, logs, or VPS
private paths. Keep Sacud/Kai integrations at service or API boundaries unless
AGPL obligations are deliberately accepted.

## Deployment Boundary

The repo deploys multiple runtime targets:

| Target | Files | Notes |
| --- | --- | --- |
| Vercel web and Edge API | [`vercel.json`](../vercel.json), [`api/`](../api), [`server/`](../server), [`src/`](../src) | Static SPA, rewrites/headers, Edge Functions, public docs proxy, MCP/OAuth/API routes. |
| Railway relay and seeders | [`scripts/`](../scripts), [`Dockerfile.relay`](../Dockerfile.relay), [`Dockerfile.seeders`](../Dockerfile.seeders) | Long-running relay and scheduled cache publishers. |
| Consumer prices service | [`consumer-prices-core/`](../consumer-prices-core) | Separate scraper/aggregation/publisher package with its own build/test scripts. |
| Tauri desktop | [`src-tauri/`](../src-tauri), [`src/services/runtime.ts`](../src/services/runtime.ts) | Native shell, sidecar, local API token flow, desktop CSP. |
| Cloudflare preflight worker | [`workers/api-cors-preflight/`](../workers/api-cors-preflight) | Deployed by worker workflow for `api.worldmonitor.app` preflights. |
| Docker/self-hosting | [`docker-compose.yml`](../docker-compose.yml), [`docker/`](../docker), [`Dockerfile`](../Dockerfile) | Self-hosted app, Redis REST proxy, relay, and optional seeders. |
| Docs | [`docs/`](../docs), [`docs/docs.json`](docs.json) | Mintlify docs proxied through Vercel at `/docs`. |

Production mutation, deploys, service restarts, Docker operations, and secret
inspection are outside normal implementation-worker scope.

## Install And Validation Commands

Use these commands from a clean worktree, with environment files linked only by
the project bootstrap helper when needed:

```bash
npm ci
npm run worktree:bootstrap
npm run dev
npm run dev:tech
npm run dev:finance
npm run dev:commodity
npm run dev:happy
npm run dev:energy
npm run typecheck
npm run typecheck:api
npm run test:data
npm run test:sidecar
npm run test:e2e
npm run docs:check
npm run lint:md
make generate
```

Heavy checks such as frontend typecheck, API typecheck, edge bundles, and
`test:data` should be run sequentially in worktrees to avoid OOM failures.
For docs-only changes, `npm run lint:md` is the minimum relevant check; run
`npm run docs:check` when architecture counts or public docs stats are touched.

## Change Recipes

Add a proto-backed endpoint:

1. Add or update `.proto` request, response, and RPC definitions under
   `proto/worldmonitor/<domain>/v1/`.
2. Include the sebuf HTTP annotations and query annotations for GET fields.
3. Run `make generate`.
4. Implement or update the handler in `server/worldmonitor/<domain>/v1/`.
5. Ensure the domain `[rpc].ts` gateway entry exists under `api/<domain>/v1/`.
6. Add cache keys that include all request-varying params and wire bootstrap only
   when a client panel consumes that seeded key.
7. Run API typecheck and focused tests.

Add a panel or map layer:

1. Add the panel under `src/components/` using the `Panel` lifecycle and event
   delegation pattern.
2. Register panel config in `src/config/panels.ts` and relevant variant defaults.
3. Wire data loading in `DataLoaderManager` and refresh cadence in `App` /
   `RefreshScheduler` when the panel needs active polling.
4. Add map layer metadata in `src/config/map-layer-definitions.ts` if the panel
   exposes map data.
5. Add focused tests for config guardrails, loading behavior, or E2E visibility
   when the change crosses variants.

Add or change seeded data:

1. Update the seeder or relay loop.
2. Write both the cache key and `seed-meta:<key>`.
3. Add health coverage in `api/health.js`.
4. Add bootstrap coverage in `api/bootstrap.js` only when client code consumes
   the raw key through `getHydratedData()`.
5. Verify TTLs, stale windows, and panel fallbacks are aligned.

## Open Risks And Unknowns

- The codebase-memory MCP project for WorldMonitor was missing during this
  review. Follow-up: index or repair `home-hermes-workspaces-worldmonitor` so
  future workers can use graph/search/trace before source scanning.
- There are two architecture references now: root `ARCHITECTURE.md` and this
  worker baseline. Follow-up: decide whether the root reference or this baseline
  should own future operational changes, then add a small docs guard if needed.
- Bootstrap and health key lists are large and manually coordinated across
  seeders, health, bootstrap, panels, and docs stats. Follow-up: continue moving
  key registration toward a generated or shared registry where practical.
- Desktop sidecar and Edge endpoints intentionally share handler code but run in
  different runtime envelopes. Follow-up: keep sidecar/API parity tests close to
  any endpoint that uses Node-only APIs, local secrets, private-network fetches,
  or cloud fallback.
- Public docs navigation already maps `architecture` to `docs/architecture.mdx`.
  Follow-up: if this baseline should be public, rename one page or adjust slugs
  deliberately rather than adding another `architecture` page to Mintlify.
