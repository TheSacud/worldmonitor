# Worldmonitor Living Roadmap

Last updated: 2026-07-07 for the 2026W28 research swarm.

The committed `research/dossier/` is canonical for this app repo. The Loop
dossier at `/home/hermes/Loop/research/dossiers/worldmonitor.md` remains the
seed reference for VPS signals; this refresh reconciles it with the committed
2026W27 note, the three parent lens handoffs, and fresh read-only probes from
the 2026W28 synthesis worktree.

Scoring uses `impact x confidence / sqrt(effort)` against the north-star:
serve a reliable public monitoring surface through `wm.sacud.com`, keep paid and
API features degraded safely behind explicit auth, and avoid exposing
origin-only Docker ports. Items that only move a metric as a bundle are scored
as one milestone.

## Current Metrics

| Metric | Current value on 2026-07-07 | Status | Evidence |
| --- | --- | --- | --- |
| Origin exposure | External TCP to `91.99.197.46:3010` was `closed_or_filtered`; local TCP to `127.0.0.1:3010` connected; `ss -H -ltn` shows `127.0.0.1:3010` | Closed | Fresh TCP/listener probes plus `/home/hermes/Loop/signals/docker-public-port-exposure.md` |
| Local health | `GET http://127.0.0.1:3010/api/service-status` returned HTTP 200, `success:true`, 2 operational services | Green but shallow | Fresh local probe at `2026-07-07T23:01:52.000Z` |
| Runtime/data readiness agreement | `GET /api/health?compact=1` returned HTTP 200 with `status:"UNHEALTHY"` and summary `total:196 ok:93 warn:21 onDemandWarn:21 crit:61` | Misaligned | Fresh local probe |
| Core UI | `GET http://127.0.0.1:3010/` returned HTTP 200 `text/html` | Serving locally | Fresh local probe |
| Docker health | Not remeasured in this lane because Docker is prohibited; Loop signal reports `worldmonitor` healthy after 2026-07-05 healthcheck remediation | Measurement gap | Loop signal plus source healthcheck only |
| AIS relay health | Not remeasured in this lane because Docker is prohibited; Loop signal reports relay healthy after secret pass-through | Measurement gap | Loop signal plus compose env pass-through only |
| Public HTTPS path | Approved fetch helper returned HTTP 200 Cloudflare Access login pages for `/` and `/api/service-status`; app body was not validated without auth | Access-gated | `research_web_fetch.py` for `https://wm.sacud.com/` and `/api/service-status` |
| Protected dependency surface | Unauthenticated maritime vessel snapshot returned HTTP 401 with `cache-control: no-store` | Safe | Fresh local probe |

## Merged Roadmap

| Score | Status | Milestone | Lenses | Target metric | I | C | E | Rationale |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 14.1 | Selected next, carried forward | Add a compact data-health rollup to `/api/service-status`, preserving HTTP 200 liveness while marking aggregate dependency state degraded or unhealthy when `/api/health?compact=1` is unhealthy | Runtime health, Dependency degradation | Authenticated degradation observability and local health fidelity | 4 | 5 | 2 | The 2026W27 synthesis selected this, but no implementation has shipped and the metric has not moved: compact health is still `UNHEALTHY` with 61 critical checks while service-status reports all operational. |
| 9.2 | Open | Replace the `@upstash/ratelimit` Lua-backed limiter path, or otherwise make it REST-command-compatible, so deployed Redis REST no longer denies limiter commands | Dependency degradation | Rate-limit degradation behavior | 4 | 4 | 3 | Loop signal reports `Command not allowed: EVAL`; source still uses `Ratelimit.slidingWindow`, so a direct limiter compatibility fix should drive this error class to zero while keeping fail-open/fail-closed policy intact. |
| 8.5 | Open | Add a Redis REST command-parity self-check for limiter Lua commands and expose only aggregate pass/fail in health | Dependency degradation | Rate-limit degradation observability | 3 | 4 | 2 | Useful as detection if the limiter cannot be replaced immediately; bundle with the limiter compatibility fix or service-status rollup for direct metric movement. |
| 8.5 | Open | Improve Docker health fidelity by checking the same nginx-served path users depend on plus one safe internal API reachability check | Runtime health | Docker health fidelity | 3 | 4 | 2 | Current healthcheck proves `/api/service-status` answers, but that endpoint is hardcoded green and does not prove route dispatch or dependency state. |
| 7.1 | Guardrail | Add a CI test that parses compose `ports:` and rejects app-facing host bindings other than `127.0.0.1` unless explicitly allowlisted | Ingress security | Origin exposure stays closed | 2 | 5 | 2 | The port exposure is closed now, but a cheap regression test would protect the north-star boundary. Impact is capped because the metric is already closed. |
| 7.1 | Guardrail | Add a no-auth/degraded smoke contract for protected dependency surfaces | Dependency degradation | Safe authenticated degradation | 2 | 5 | 2 | Fresh maritime probe returned 401/no-store; keep that property tested while service-status grows aggregate dependency reporting. Impact is capped because it prevents regressions rather than fixing the current health mismatch. |
| 7.1 | Open | Make operator status taxonomy explicit: runtime liveness, data readiness, public ingress, and dependency degradation must not be collapsed into one green or red status | Runtime health | Alert accuracy | 2 | 5 | 2 | The repo intentionally treats `/api/health` as data readiness, but operators can still confuse it with container liveness. |
| 6.9 | Open | Add a browser-session-safe bootstrap availability probe that reports aggregate tier availability without minting sessions or dumping payloads | Runtime health | Core UI hydration health | 3 | 4 | 3 | Parent runtime probes could not check authenticated bootstrap safely; an aggregate endpoint would close that gap. |
| 6.9 | Open | Surface compact-health dependency categories in the UI or status surface without exposing unauthenticated internals | Dependency degradation | Safe visible degradation | 3 | 4 | 3 | Users and operators need to see stale or empty dependency classes without exposing upstream details or secret-backed checks. |
| 6.9 | Open | Decide AIS behavior when `AISSTREAM_API_KEY` is absent: make AIS explicitly optional/degraded or keep env pass-through as a required deployment invariant | Dependency degradation | AIS relay health | 3 | 4 | 3 | The live relay is reported healthy when the key is passed through, but source still exits when the key is absent. This moves health only if bundled with deployment verification. |
| 6.0 | Partial | Add a sanctioned public-path smoke that distinguishes Cloudflare Access challenge, Nginx reachability, and authenticated app body reachability without exposing credentials | Ingress security | Public ingress validation coverage | 2 | 3 | 1 | The approved helper now reaches `wm.sacud.com`, but only verifies the Cloudflare Access challenge for this worker. |
| 5.7 | Backlog | Add a non-secret ingress audit runbook or script that reports listener scope, local health, public negative TCP probe, and optional privileged NAT state | Ingress security | Origin exposure detection | 2 | 4 | 2 | Useful operator evidence, but it detects rather than remediates exposure. |
| 4.6 | Backlog | Triage compact-health critical checks into seed-bundle and API-owner buckets and connect them to seed run outcome reporting | Dependency degradation | Local health critical count | 2 | 4 | 3 | Diagnostic alone; it only moves the metric when bundled with seed or source fixes. |

## Closed Or Superseded Items

| Item | Status | Evidence |
| --- | --- | --- |
| Rebind worldmonitor Docker port to `127.0.0.1` | Shipped operationally | Loop signal records 2026-07-05 remediation; fresh external TCP to `91.99.197.46:3010` fails or filters; compose binds `127.0.0.1:${WM_PORT:-3000}:8080`. |
| Fix worldmonitor healthcheck target from `localhost` ambiguity to `127.0.0.1` in compose | Shipped operationally | Loop signal reports Docker healthy after the override; current compose healthcheck uses `http://127.0.0.1:8080/api/service-status`. |
| Pass relay shared secret through Docker services | Shipped operationally | Loop signal reports `worldmonitor-ais-relay` healthy after relay secret pass-through; current compose requires `RELAY_SHARED_SECRET` for app, relay, and seeders. |

## Conflict Resolution

Ingress security remains closed, so its roadmap entries are guardrails and
measurement coverage rather than the top metric mover. Runtime health and
dependency degradation still point to the same top milestone:
`service-status` should remain safe for liveness but must stop hiding aggregate
unhealthy data readiness. The Redis limiter incompatibility is the strongest
next dependency fix, but it does not beat the unresolved status-surface
misalignment until operators can see aggregate degradation without logs.
