# Worldmonitor Research Decisions

## 2026-07-07: Carry Forward Service-Status Rollup For 2026W28

Context:

- The committed `research/dossier/` is now canonical for this repo. It was
  created by PR #5, `docs: synthesize worldmonitor research swarm`, which
  merged on 2026-07-07.
- The previous selected implementation change was a compact data-health rollup
  in `/api/service-status`. That recommendation shipped as documentation only;
  no implementation PR is currently open.
- The target metric has not moved. Fresh probes on 2026-07-07 show
  `/api/service-status` returning HTTP 200 with `success:true` and 2
  operational services, while `/api/health?compact=1` returns HTTP 200 with
  `status:"UNHEALTHY"` and 61 critical compact-health checks.
- Open PR overlap check
  `gh pr list --repo TheSacud/worldmonitor --state open --json number,title,headRefName,body`
  returned `[]`, so no open PR already ships or proposes the selected next
  change.
- Ingress remains closed: TCP to `91.99.197.46:3010` was `closed_or_filtered`,
  local `127.0.0.1:3010` connected, and `ss -H -ltn` shows app port 3010 bound
  to loopback.
- The approved fetch helper reached `https://wm.sacud.com/` and
  `https://wm.sacud.com/api/service-status` on 2026-07-07, both returning HTTP
  200 Cloudflare Access login pages. Authenticated app-body validation remains
  out of scope for this worker.

Decision:

Carry forward the selected next implementation change: add a compact
data-health rollup to `/api/service-status`. The endpoint should keep HTTP 200
liveness semantics for Docker and external monitors, avoid detailed or
secret-bearing payloads, and mark aggregate dependency state degraded or
unhealthy when `/api/health?compact=1` is unhealthy.

Why this beats the alternatives:

- The direct origin exposure metric is already closed, so ingress work is now
  regression prevention rather than the highest-impact metric mover.
- Redis limiter compatibility is the strongest dependency fix, but operators
  still need the aggregate status surface first so rate-limit or seed-health
  degradation is visible without reading logs.
- AIS absent-key behavior is important but currently reported healthy when the
  deployment passes the key through; the remaining source behavior should be
  handled after the main status surface stops masking aggregate degradation.

How to test the selected change:

- Add focused sidecar tests for `/api/service-status` covering healthy compact
  health, unhealthy compact health, and compact-health fetch failure.
- Run `node --test src-tauri/sidecar/local-api-server.test.mjs`.
- Run `node --test tests/health-redis-down-status.test.mjs`.
- In a local or staging self-host run, compare
  `GET http://127.0.0.1:3010/api/service-status` and
  `GET http://127.0.0.1:3010/api/health?compact=1`; service-status should stay
  HTTP 200 while exposing only aggregate data-readiness state.

Consequences:

- The W27 top recommendation remains the W28 selected next change because it
  has not shipped and its metric has not moved.
- Redis limiter compatibility moves up as the next dependency-specific
  follow-up once service-status exposes aggregate dependency health.
- Docker and AIS relay health still require a differently permissioned
  operator check for live container state.

## 2026-07-07: Select Service-Status Degradation Alignment

Context:

- This is the first committed living research dossier for this repo. There was
  no previous `research/dossier/DECISIONS.md` or dated note to open locally, so
  the retro uses the Loop seed dossier and recent GitHub history.
- The previous seed top pick, rebinding the worldmonitor Docker app port to
  loopback, shipped operationally on 2026-07-05. The target metric moved:
  external TCP to `91.99.197.46:3010` now fails, `ss -tuln` shows
  `127.0.0.1:3010`, and current compose binds
  `127.0.0.1:${WM_PORT:-3000}:8080`.
- `gh pr list --repo TheSacud/worldmonitor --state open --json number,title,headRefName,body`
  returned no open PRs on 2026-07-07, so no open PR already ships or proposes
  the selected next change.
- Parent lens handoffs converged on an observability mismatch: local
  `/api/service-status` is green, but `/api/health?compact=1` is unhealthy.
  Fresh probes on 2026-07-07 show the mismatch widened to 60 critical compact
  health checks.
- Docker and AIS relay health could not be remeasured in this worker lane
  because Docker and broad sudo are prohibited. The Loop signal still reports
  them healthy after the 2026-07-05 remediation.

Decision:

Select the next implementation change as adding a compact data-health rollup to
`/api/service-status`. The endpoint should keep HTTP 200 liveness semantics for
Docker and external monitors, avoid detailed or secret-bearing payloads, and
mark aggregate dependency state degraded or unhealthy when
`/api/health?compact=1` is unhealthy.

Why this beats the alternatives:

- Ingress rebinding and healthcheck remediation already shipped; follow-up port
  tests are valuable guardrails but do not move the currently closed origin
  exposure metric as much.
- Redis command parity and AIS absent-key behavior are still important, but the
  user-visible problem is that the main operator status surface can stay green
  while dependency/data readiness is unhealthy.
- A safe aggregate rollup directly advances the north-star clause about paid and
  API features degrading observably without leaking secrets.

How to test the selected change:

- Add focused sidecar tests for `/api/service-status` covering healthy compact
  health, unhealthy compact health, and compact-health fetch failure. The last
  case should report `unknown` or degraded aggregate state without failing the
  liveness HTTP response.
- Run `node --test src-tauri/sidecar/local-api-server.test.mjs`.
- Run the existing health degradation tests that cover safe status exposure:
  `node --test tests/health-redis-down-status.test.mjs`.
- On a local or staging self-host run, compare
  `GET http://127.0.0.1:3010/api/service-status` and
  `GET http://127.0.0.1:3010/api/health?compact=1`; service-status should stay
  HTTP 200 while exposing only aggregate data-readiness state.

Consequences:

- Docker liveness remains stable because the selected change should not make
  `/api/service-status` return non-200 for data readiness problems.
- Operator status becomes less misleading during dependency degradation.
- Follow-up work can then decide whether Docker health should remain pure
  liveness or include a stricter internal route check.
