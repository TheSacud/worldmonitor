# AGENTS.md

## Sacud VPS Fork Workflow

- This local clone and the VPS deployment are based on the `TheSacud/worldmonitor` fork.
- Keep `origin` pointing to `git@github.com:TheSacud/worldmonitor.git`.
- Keep `upstream` pointing to `https://github.com/koala73/worldmonitor.git` for pulling original project updates only.
- Do not push to `upstream`; on the VPS it should stay configured as `DISABLED` for push.
- Use the `sacud/vps` branch for Sacud-specific deployment changes, local config examples, service wrappers, nginx/systemd notes, and integration work with Kai.
- To update from the original project: fetch `upstream`, merge or rebase `upstream/main` into `sacud/vps`, resolve conflicts deliberately, then push only to `origin`.
- Because this project is AGPL-3.0, keep Kai integration at service/API boundaries unless deliberately accepting AGPL obligations for copied or derived code.
- Do not commit secrets, `.env` files, generated runtime data, Cloudflare Access tokens, API keys, or VPS-only private paths.

Agent entry point for WorldMonitor. Read this first, then follow links for depth.

## What This Project Is

Real-time global intelligence dashboard. TypeScript SPA (Vite + Preact) with 160 top-level TypeScript component files, 80+ Vercel Edge API endpoint entries, a Tauri desktop app with Node.js sidecar, and a Railway relay service. Aggregates geopolitics, military, finance, climate, cyber, maritime, and aviation data across 35 freshness-tracked source groups.

## Repository Map

```
.
├── src/                    # Browser SPA (TypeScript, class-based components)
│   ├── app/                # App orchestration (data-loader, refresh-scheduler, panel-layout)
│   ├── bootstrap/          # Startup/recovery (chunk reload, deferred Sentry, SW update)
│   ├── components/         # 160 top-level TypeScript component files
│   ├── config/             # Variant configs, panel/layer definitions, market symbols
│   ├── services/           # Business logic (194 service modules and domain directories)
│   ├── shared/             # Cross-cutting helpers (premium paths, registries, staleness)
│   ├── embed/              # Embeddable widget loader
│   ├── styles/             # Global CSS (layers, themes, panel styles)
│   ├── shims/              # Runtime shims (child-process for sidecar)
│   ├── data/               # Static JSON datasets (conservation, renewable, happiness)
│   ├── e2e/                # Map test harnesses (consumed by Playwright specs)
│   ├── types/              # TypeScript type definitions
│   ├── utils/              # Shared utilities (circuit-breaker, theme, URL state, DOM)
│   ├── workers/            # Web Workers (analysis, ML/ONNX, vector DB)
│   ├── generated/          # Proto-generated client/server stubs (DO NOT EDIT)
│   ├── locales/            # i18n translation files
│   └── App.ts              # Main application entry
├── api/                    # Vercel Edge Functions (plain JS, self-contained)
│   ├── _*.js               # Shared helpers (CORS, rate-limit, API key, relay)
│   ├── health.js           # Health check endpoint
│   ├── bootstrap.js        # Bulk data hydration endpoint
│   └── <domain>/           # Domain-specific endpoints (aviation/, climate/, etc.)
├── server/                 # Server-side shared code (used by Edge Functions)
│   ├── _shared/            # Redis, rate-limit, LLM, caching, response headers
│   ├── gateway.ts          # Domain gateway factory (CORS, auth, cache tiers)
│   ├── router.ts           # Route matching
│   └── worldmonitor/       # Domain handlers (mirrors proto service structure)
├── proto/                  # Protobuf definitions (sebuf framework)
│   ├── buf.yaml            # Buf configuration
│   └── worldmonitor/       # Service definitions with HTTP annotations
├── shared/                 # Cross-platform data (JSON configs for markets, RSS domains)
├── data/                   # Static data (telegram channels, OREF threat translations, gamma irradiators)
├── public/                 # Static assets served as-is (favicons, textures, .well-known, llms.txt)
├── scripts/                # Seed scripts, build helpers, data fetchers
├── src-tauri/              # Tauri desktop shell (Rust + Node.js sidecar)
│   └── sidecar/            # Node.js sidecar API server
├── consumer-prices-core/   # Consumer-price scrapers (Playwright, per-country baskets; Railway/Docker)
├── workers/                # Cloudflare Workers (edge CORS preflight for api.worldmonitor.app)
├── tests/                  # Unit/integration tests (node:test runner)
├── e2e/                    # Playwright E2E specs
├── pro-test/               # Standalone Pro QA app (separate package)
├── docs/                   # Mintlify documentation site
├── docker/                 # Docker build for Railway services
├── deploy/                 # Deployment configs (nginx)
└── blog-site/              # Static blog (built into public/blog/)
```

## How to Run

```bash
npm ci                   # Deterministic install (also runs blog-site postinstall)
npm run dev              # Start Vite dev server (full variant)
npm run dev:tech         # Start tech-only variant
npm run dev:energy       # Start energy-security variant
npm run typecheck        # tsc --noEmit (strict mode)
npm run typecheck:api    # Typecheck API layer separately
npm run test:data        # Run unit/integration tests
npm run test:sidecar     # Run sidecar + API handler tests
npm run test:e2e         # Run all Playwright E2E tests
make generate            # Regenerate proto stubs + per-service & unified OpenAPI specs (requires buf + sebuf v0.11.1 plugins)
npm run worktree:bootstrap          # Fresh worktree: link local env files + npm ci with tmp cache
npm run worktree:bootstrap:test-only # Fresh docs/test worktree: same, but npm ci --ignore-scripts
npm run worktree:env                # Link ignored local env files only
```

## Fresh Worktree Bootstrap

Worktrees usually start without ignored local state. When creating or entering one:

1. Start from `origin/main` or the requested base, not a dirty local branch.
2. Run `npm run worktree:bootstrap` before typecheck/tests. The helper links ignored `.env.local` / `.env` from the main worktree when Git can infer it, and installs deps with `npm ci --cache /tmp/worldmonitor-npm-cache`.
3. If only docs/test tooling is needed and native postinstall work is unnecessary, use `npm run worktree:bootstrap:test-only`.
4. If live credentials are unavailable, do not fabricate secrets. Run the non-credentialed checks you can and report the credential gate explicitly.

Env rules:

- Link only `.env.local` and `.env`. Never copy or link `.env.vercel-backup` or `.env.vercel-export`; the pre-push guard blocks those files even as symlinks.
- Override env source discovery with `WM_ENV_SOURCE=/path/to/worldmonitor npm run worktree:env` when the main worktree cannot be inferred.
- `.env*` files are ignored local state. Do not add, print, or summarize secret values.

Validation hygiene:

- Prefer `npm ci` over `npm install` in fresh worktrees. Use `npm_config_cache=/tmp/worldmonitor-npm-cache` for `npx` or install commands if cache ownership errors appear.
- After bootstrap or pre-push, run `git status --short`. If dependency bootstrap changed lockfiles you did not intend to edit, remove those incidental changes before finalizing.
- After install, prefer local tools such as `./node_modules/.bin/tsx --test ...` for focused TypeScript tests when `npx` is flaky.

## Workspace Test And PR Handoff Commands

Use these commands for Hermes-owned worktrees. Keep heavy checks sequential;
parallel `test:data`, typecheck, or edge-bundle runs can OOM in worktrees.

### Read-Only Diagnosis

Run this before editing, without reading `.env*`, database files, generated
runtime state, Cloudflare tokens, API keys, or other raw credentials:

```bash
git status --short
git worktree list
gh pr list --search "<issue-or-task-id>" --state open --json number,title,headRefName,url
rg --files -g 'package.json' -g 'pyproject.toml' -g 'AGENTS.md' -g '!data/**' -g '!src/data/**' -g '!node_modules/**' -g '!**/.env*'
```

### Install And Bootstrap

For a fresh worktree, prefer the repository helper so ignored local env links
and npm cache settings are handled consistently:

```bash
npm run worktree:bootstrap
git status --short
```

For docs-only or test-discovery work where native postinstall work is not
needed:

```bash
npm run worktree:bootstrap:test-only
git status --short
```

If the helper is unavailable and no secrets are needed, use deterministic npm
install directly:

```bash
npm ci --cache /tmp/worldmonitor-npm-cache
```

### Lint And Typecheck

For markdown-only changes:

```bash
npm run lint:md
```

For source, API, server, or script changes, run the relevant checks
sequentially:

```bash
npm run lint
npm run typecheck
npm run typecheck:api
```

When `convex/` changes, also run:

```bash
npm run test:convex
```

### Unit And Integration Tests

Use the broad suites for app PR handoff when dependencies and credentials are
available:

```bash
npm run test:data
npm run test:sidecar
```

Use focused local tools for narrow changes:

```bash
./node_modules/.bin/tsx --test tests/<name>.test.mts
./node_modules/.bin/tsx --test tests/<name>.test.mjs
node --test api/<name>.test.mjs
```

### Smoke And E2E Tests

Playwright tests start a local Vite server on `127.0.0.1:4173`. Install the
Chromium browser once per machine if it is missing:

```bash
npx playwright install chromium
```

Run the narrow runtime smoke first:

```bash
npm run test:e2e:runtime
```

For variant smoke, run the touched variant when possible, or all variants for a
release handoff:

```bash
npm run test:e2e:variant-smoke:full
npm run test:e2e:variant-smoke:energy
npm run test:e2e:variant-smoke
```

Known smoke gaps:

- Some smoke tests exercise local API routes backed by live upstream data. They
  are useful for app-level regressions, but upstream provider outages can still
  produce diagnostics or flakes.
- Playwright browser dependencies may be absent in fresh servers; record that
  as an environment gap rather than bypassing the test.
- `make generate` is only required for proto/API-contract changes and needs Go,
  `buf`, and the pinned sebuf plugins.

### PR Handoff

Before committing:

```bash
git status --short
git diff --check
npm run lint:md
```

For code changes, include the relevant lint, typecheck, unit, and smoke commands
from the sections above. Then commit and open a draft PR against `sacud/vps`:

```bash
git add <changed-files>
git commit -m "<type>: <summary>"
git push -u origin HEAD
gh pr create --draft --base sacud/vps --head "$(git branch --show-current)" --fill
```

Include the branch, changed files, tests run, and any skipped checks with exact
reasons in the PR body or handoff note. Do not deploy, restart services, use
Docker, or mutate production from a PR handoff worktree.

Known handoff gaps:

- This Sacud fork worktree may only fetch `origin/sacud/vps`; if `origin/main`
  is absent, the pre-push hook cannot scope against `origin/main` and falls back
  to broader invariant checks.
- The local remote configuration is shared repo state. If `origin` or
  `upstream` differs from the Sacud workflow above, record it and ask for a
  repo-maintainer fix rather than mutating shared remotes from a task worktree.

## Architecture Rules

### Dependency Direction

```
types -> config -> services -> components -> app -> App.ts
```

- `types/` has zero internal imports
- `config/` imports only from `types/`
- `services/` imports from `types/` and `config/`
- `components/` imports from all above
- `app/` orchestrates components and services

### API Layer Constraints

- `api/*.js` are Vercel Edge Functions: **self-contained JS only**
- They CANNOT import from `../src/` or `../server/` (different runtime)
- Only same-directory `_*.js` helpers and npm packages
- Enforced by `tests/edge-functions.test.mjs` and pre-push hook esbuild check

### Server Layer

- `server/` code is bundled INTO Edge Functions at deploy time via gateway
- `server/_shared/` contains Redis client, rate limiting, LLM helpers
- `server/worldmonitor/<domain>/` has RPC handlers matching proto services
- All handlers use `cachedFetchJson()` for Redis caching with stampede protection

### Proto Contract Flow

```
proto/ definitions -> buf generate -> src/generated/{client,server}/ -> handlers wire up
```

- GET fields need `(sebuf.http.query)` annotation
- `repeated string` fields need `parseStringArray()` in handler
- `int64` maps to `string` in TypeScript
- CI checks proto freshness via `.github/workflows/proto-check.yml`

## Variant System

The app ships multiple variants with different panel/layer configurations:

- `full` (default): All features
- `tech`: Technology-focused subset
- `finance`: Financial markets focus
- `commodity`: Commodity markets focus
- `happy`: Positive news only
- `energy`: Energy security, chokepoints, oil/gas, and disruption timelines

Variant is set via `VITE_VARIANT` env var. Config lives in `src/config/variants/`.

## Key Patterns

### Adding a New API Endpoint

1. Define proto message in `proto/worldmonitor/<domain>/`
2. Add RPC with `(sebuf.http.config)` annotation
3. Run `make generate`
4. Create handler in `server/worldmonitor/<domain>/`
5. Wire handler in domain's `handler.ts`
6. Use `cachedFetchJson()` for caching, include request params in cache key

### Adding a New Panel

1. Create `src/components/MyPanel.ts` extending `Panel`
2. Register in `src/config/panels.ts`
3. Add to variant configs in `src/config/variants/`
4. Wire data loading in `src/app/data-loader.ts`

### Circuit Breakers

- `src/utils/circuit-breaker.ts` for client-side
- Used in data loaders to prevent cascade failures
- Separate breaker per data domain

### Caching

- Redis (Upstash) via `server/_shared/redis.ts`
- `cachedFetchJson()` coalesces concurrent cache misses
- Cache tiers: fast (5m), medium (10m), slow (30m), static (2h), daily (24h)
- Cache key MUST include request-varying params

## Testing

- **Unit/Integration**: `tests/*.test.{mjs,mts}` using `node:test` runner
- **Sidecar tests**: `api/*.test.mjs`, `src-tauri/sidecar/*.test.mjs`
- **E2E**: `e2e/*.spec.ts` using Playwright
- **Visual regression**: Golden screenshot comparison per variant

## CI Checks (GitHub Actions)

| Workflow | Trigger | What it checks |
|---|---|---|
| `typecheck.yml` | PR + push to main | `tsc --noEmit` for src and API |
| `lint.yml` | PR (markdown changes) | markdownlint-cli2 |
| `proto-check.yml` | PR (proto changes) | Generated code freshness |
| `build-desktop.yml` | Manual | Tauri desktop build |
| `test-linux-app.yml` | Manual | Linux AppImage smoke test |

## Pre-Push Hook

Runs automatically before `git push`. Two tiers:

**Always (state-dependent, fast — run even on a cache hit):** local Vercel env-dump guard, PR-state check (no pushes to merged/closed PR branches), branch-contamination guard (>20 commits ahead), `scripts/` lockfile sync.

**Tree-dependent (skipped entirely on a green-tree cache hit):** Unicode safety and version sync (always run for uncached trees), plus the diff-scoped checks: TypeScript (frontend tsc on `src/`-surface changes; `typecheck:api` on `api/|server/|scripts/|src/generated/`; Convex tsc on `convex/`), CJS syntax, boundary/safe-html/Sentry-coverage/rate-limit/premium-fetch lints (each also fires when its own guardrail script changes), edge esbuild check (`api/|server/|src/generated/` — edge entries bundle-import server code), markdown/MDX lint, proto + pro-test bundle freshness, change-scoped tests. `package.json`/`tsconfig` changes — or an unresolvable `origin/main` diff — force everything (an unresolvable diff also bypasses the green-tree cache: a blind run trusts nothing, including prior attestations).

**Green-tree cache:** a tree that passed the full gate is recorded (`$GIT_DIR/wm-prepush-green`); re-pushing the identical tree (remote failure, message-only amend) skips all tree-dependent checks — same tree, same result. Delete that file to force a full re-run.

Heavy checks (`test:data`, typechecks, edge-bundle) must run **sequentially** in worktrees — parallel runs OOM (exit 137).

## Shipping Velocity (Agent Workflow)

- **Before starting work on an issue:** check for parallel/duplicate work first — `gh pr list --search "<issue#>"` AND `git worktree list` (background codex/claude sessions ship PRs under the same account).
- **After pushing a PR:** don't sleep-poll CI. Enable auto-merge (`gh pr merge <n> --auto --squash` — repo has auto-merge enabled) and/or start `gh pr checks <n> --watch` as a background task; act only when it exits.
- **docs/plans/ is gitignored** — plan documents are local working state and do not travel between worktrees or ship in PRs.
- **PR-review verification:** never assert a finding is fixed/stale from memory — re-fetch the PR head SHA and diff the cited lines first.

## Deployment

- **Web**: Vercel (auto-deploy on push to main)
- **Relay/Seeds**: Railway (Docker, cron services)
- **Desktop**: Tauri builds via GitHub Actions
- **Docs**: Mintlify (proxied through Vercel at `/docs`)

## Critical Conventions

- `fetch.bind(globalThis)` is BANNED. Use `(...args) => globalThis.fetch(...args)` instead
- Edge Functions cannot use `node:http`, `node:https`, `node:zlib`
- Always include `User-Agent` header in server-side fetch calls
- Yahoo Finance requests must be staggered (150ms delays)
- New data sources MUST have bootstrap hydration wired in `api/bootstrap.js`
- Redis seed scripts MUST write `seed-meta:<key>` for health monitoring

## External References

- [Architecture (system reference)](ARCHITECTURE.md)
- [Design Philosophy (why decisions were made)](docs/architecture.mdx)
- [Contributing guide](CONTRIBUTING.md)
- [Data sources catalog](docs/data-sources.mdx)
- [Health endpoints](docs/health-endpoints.mdx)
- [Adding endpoints guide](docs/adding-endpoints.mdx)
- [API reference (OpenAPI)](docs/api/)
