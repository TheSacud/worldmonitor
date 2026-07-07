# Worldmonitor Research Swarm Synthesis, 2026W27

## What The Data Says

Measured on 2026-07-07 from
`/home/hermes/worktrees/worldmonitor/t_17b755ef`, branch
`codex/worldmonitor/t_17b755ef-synthesize-the-research-swarm-for-worldmonitor-2`.

Prior recommendation retro comes first because this is the first committed
living dossier in the app repo. There was no previous local dated note or
`research/dossier/DECISIONS.md` to open. The Loop seed's top pick was to rebind
the worldmonitor Docker app port to `127.0.0.1`; that shipped operationally on
2026-07-05 per `/home/hermes/Loop/signals/docker-public-port-exposure.md`, and
the target metric moved. Fresh external TCP to `91.99.197.46:3010` returned
connection refused, local `ss -tuln` shows `127.0.0.1:3010`, and current compose
binds `127.0.0.1:${WM_PORT:-3000}:8080`.

Open PR overlap check: `gh pr list --repo TheSacud/worldmonitor --state open --json number,title,headRefName,body`
returned `[]`, so no open PR already ships or proposes the selected next
change. Recent merged PRs are docs-only guardrail/baseline work and do not
overlap this recommendation.

Current success and diagnostic metrics:

| Metric | Current value | Interpretation |
| --- | --- | --- |
| Origin exposure | External TCP to `91.99.197.46:3010` failed with connection refused; local `ss -tuln` shows `127.0.0.1:3010` only | Closed |
| Local service status | `GET http://127.0.0.1:3010/api/service-status` returned HTTP 200, `success:true`, timestamp `2026-07-07T08:20:34.037Z`, and 2 operational services | Green, but shallow |
| Compact data health | `GET http://127.0.0.1:3010/api/health?compact=1` returned HTTP 200 with `status:"UNHEALTHY"` and summary `total:196 ok:101 warn:13 onDemandWarn:22 crit:60` | Degraded and not reflected in service-status |
| Core UI | `GET http://127.0.0.1:3010/` returned HTTP 200 `text/html` | Serving locally |
| Docker health | Not remeasured because Docker is prohibited in this worker lane; Loop signal says `worldmonitor` became healthy after the 2026-07-05 healthcheck remediation | Measurement gap |
| AIS relay health | Not remeasured because Docker is prohibited in this worker lane; Loop signal says `worldmonitor-ais-relay` became healthy after relay secret pass-through | Measurement gap |
| Public HTTPS path | Sanctioned helper rejected `wm.sacud.com` as not allowlisted for both `/` and `/api/service-status` | Measurement gap |

The repo did not have committed `research/dossier/` files, so the Loop dossier
seed is the canonical starting point for this pass. The main reconciliation is
that the seed's highest-risk ingress and Docker-health items have since moved
operationally, while the dependency/status mismatch remains live and worsened
from the parent lens snapshot of 48 critical compact-health checks to 60.

## Parent Lens Inputs

Ingress security found that the original public Docker app-port exposure is
closed. Its best remaining candidates are guardrails: a compose port-binding
test, a sanitized ingress audit script or runbook, public HTTPS allowlisting for
sanctioned smoke checks, and nginx handoff documentation. Because the metric is
already closed, these are scored as regression prevention rather than the next
highest-impact metric mover.

Runtime health found that local serving works, but actual Docker health could
not be remeasured under no-Docker limits. It also found the key mismatch:
`/api/service-status` reports a hardcoded green status while `/api/health` is a
data-readiness endpoint that can be unhealthy. The parent lens recommended
hardening service-status or Docker health checks so runtime signals agree.

Dependency degradation found good existing auth and degradation safeguards:
rate-limit degradation markers, premium-path Bearer scoping, detailed health
guarding, and relay health without secret disclosure. Its strongest gap is the
same observability mismatch: service-status is green while compact health is
unhealthy. It also raised Redis REST command parity, AIS absent-key behavior,
and safer UI/status surfacing of dependency categories.

No parent lens was missing a `## LENS FINDINGS` handoff. The only common
unknown across lenses is production-only Docker/NAT state, which this worker
lane cannot inspect.

## Prior Recommendation Retro

The Loop seed roadmap top pick was "Rebind worldmonitor Docker port to
`127.0.0.1`." That work shipped operationally outside this PR-producing research
card on 2026-07-05. Evidence: the Loop signal records the remediation, current
compose has the loopback bind, local listeners show `127.0.0.1:3010`, and a
fresh public TCP probe to `91.99.197.46:3010` fails. Its target metric, origin
exposure, moved from open to closed.

The seed's second and third items, Docker health and AIS relay health, are
reported closed by the Loop signal after the healthcheck override and relay
secret pass-through. They were not directly remeasured here because this lane
cannot run Docker.

The remaining seed item, Redis REST command support for rate limiting, is still
open. The Loop signal reports `Command not allowed: EVAL`; source now allows
`EVAL`, `EVALSHA`, and `EVALSHA_RO` in the Redis REST proxy, so the remaining
need is deployed command-parity detection and aggregate reporting.

## Merged Scored Roadmap

| Score | Status | Milestone | Lenses | Target metric |
| --- | --- | --- | --- | --- |
| 14.1 | Selected next | Add compact data-health rollup to `/api/service-status`, preserving HTTP 200 liveness while marking aggregate dependency state degraded or unhealthy when compact health is unhealthy | Runtime health, Dependency degradation | Authenticated degradation observability and local health fidelity |
| 8.5 | Open | Add Redis REST command-parity self-check for limiter Lua commands and expose only aggregate pass/fail in health | Dependency degradation | Rate-limit degradation observability |
| 8.5 | Open | Improve Docker health fidelity by checking the same nginx-served path users depend on plus one safe internal API reachability check | Runtime health | Docker health fidelity |
| 7.1 | Guardrail | Add a CI compose test that rejects app-facing non-loopback host port binds unless explicitly allowlisted | Ingress security | Origin exposure stays closed |
| 7.1 | Open | Make operator status taxonomy explicit: runtime liveness, data readiness, public ingress, and dependency degradation | Runtime health | Alert accuracy |
| 6.9 | Open | Add a browser-session-safe bootstrap availability probe without session minting or payload dumps | Runtime health | Core UI hydration health |
| 6.9 | Open | Surface compact-health dependency categories in UI/status surfaces without exposing unauthenticated internals | Dependency degradation | Safe visible degradation |
| 6.0 | Gap | Add `wm.sacud.com` to the sanctioned research fetch allowlist or provide an equivalent public smoke mechanism | Ingress security | Public ingress validation coverage |
| 5.7 | Open | Decide AIS behavior when `AISSTREAM_API_KEY` is absent or keep env pass-through as a required deployment invariant | Dependency degradation | AIS relay health |
| 5.7 | Backlog | Add a non-secret ingress audit runbook or script | Ingress security | Origin exposure detection |
| 4.6 | Backlog | Triage compact-health critical checks into seed-bundle and API-owner buckets | Dependency degradation | Local health critical count |

Conflict resolution: the seed's 25-point ingress item is now closed, so it no
longer competes for the next change. The runtime and dependency lenses describe
the same top milestone from different angles, so they are deduped into one
selected change rather than split into separate service-status and UI-health
items. Redis and AIS remain valid but do not beat a status surface that is
currently green while compact health is unhealthy.

## Selected Next Change

Selected next implementation change: add a compact data-health rollup to
`/api/service-status`.

Implementation intent:

- Keep `/api/service-status` unauthenticated and HTTP 200 for liveness and
  Docker healthcheck compatibility.
- Add only aggregate data-readiness fields derived from compact health, such as
  status and summary counts, with no detailed provider payloads, secrets, key
  names, or logs.
- Mark the service-status summary degraded or unhealthy when compact health is
  unhealthy, and mark data-readiness unknown if the compact health check itself
  fails.
- Preserve existing auth behavior for detailed health and API routes.

How to test it:

- Add focused tests in `src-tauri/sidecar/local-api-server.test.mjs` for healthy
  compact health, unhealthy compact health, and compact-health fetch failure.
- Run `node --test src-tauri/sidecar/local-api-server.test.mjs`.
- Run `node --test tests/health-redis-down-status.test.mjs`.
- In a local or staging self-host run, compare
  `GET http://127.0.0.1:3010/api/service-status` with
  `GET http://127.0.0.1:3010/api/health?compact=1`; service-status should stay
  HTTP 200 while exposing only aggregate data-readiness state.

## Validation Gaps

- Docker health, Docker published bindings, and Docker NAT rules were not
  remeasured because this worker is prohibited from using Docker or broad sudo.
- Public `https://wm.sacud.com/` and
  `https://wm.sacud.com/api/service-status` were not fetched because the
  sanctioned helper rejected `wm.sacud.com` as not allowlisted on 2026-07-07.
- Live Redis error frequency was not measured because logs, Redis state, and
  private runtime state are out of scope.
- No secrets, `.env` files, databases, logs, Docker inspect output, or private
  runtime state were read.
