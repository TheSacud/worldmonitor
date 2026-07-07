# Worldmonitor Living Roadmap

Last updated: 2026-07-07 for the 2026W27 research swarm.

This repository did not have a committed `research/dossier/` before this
update. The Loop dossier at `/home/hermes/Loop/research/dossiers/worldmonitor.md`
was used as the seed, then reconciled with the three parent lens handoffs and
fresh read-only probes from this worktree.

Scoring uses `impact x confidence / sqrt(effort)` against the north-star:
serve a reliable public monitoring surface through `wm.sacud.com`, keep paid and
API features degraded safely behind explicit auth, and avoid exposing
origin-only Docker ports. Items that only move a metric as a bundle are scored
as one milestone.

## Current Metrics

| Metric | Current value on 2026-07-07 | Status | Evidence |
| --- | --- | --- | --- |
| Origin exposure | External TCP to `91.99.197.46:3010` returned connection refused; local `ss -tuln` shows `127.0.0.1:3010` only | Closed | Fresh probe plus `/home/hermes/Loop/signals/docker-public-port-exposure.md` |
| Local health | `GET http://127.0.0.1:3010/api/service-status` returned HTTP 200, `success:true`, 2 operational services | Green but shallow | Fresh local probe at `2026-07-07T08:20:34.037Z` |
| Runtime/data readiness agreement | `GET /api/health?compact=1` returned HTTP 200 with `status:"UNHEALTHY"` and summary `total:196 ok:101 warn:13 onDemandWarn:22 crit:60` | Misaligned | Fresh local probe |
| Core UI | `GET http://127.0.0.1:3010/` returned HTTP 200 `text/html` | Serving locally | Fresh local probe |
| Docker health | Not remeasured in this lane because Docker is prohibited; Loop signal reports `worldmonitor` healthy after 2026-07-05 healthcheck remediation | Measurement gap | Loop signal plus source healthcheck only |
| AIS relay health | Not remeasured in this lane because Docker is prohibited; Loop signal reports relay healthy after secret pass-through | Measurement gap | Loop signal plus compose env pass-through only |
| Public HTTPS path | Not fetched because the sanctioned helper rejected `wm.sacud.com` as not allowlisted | Measurement gap | `research_web_fetch.py` exit 2 |

## Merged Roadmap

| Score | Status | Milestone | Lenses | Target metric | I | C | E | Rationale |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 14.1 | Selected next | Add a compact data-health rollup to `/api/service-status`, preserving HTTP 200 liveness while marking aggregate dependency state degraded or unhealthy when `/api/health?compact=1` is unhealthy | Runtime health, Dependency degradation | Authenticated degradation observability and local health fidelity | 4 | 5 | 2 | Parent lenses agree the largest remaining gap is green service-status masking unhealthy compact health. Fresh probes show 60 critical data checks while service-status reports all operational. |
| 8.5 | Open | Add a Redis REST command-parity self-check for limiter Lua commands and expose only aggregate pass/fail in health | Dependency degradation | Rate-limit degradation observability | 3 | 4 | 2 | Loop signal reports deployed `EVAL` failures; source proxy allows `EVAL`, `EVALSHA`, and `EVALSHA_RO`, so the gap is deployed command support or drift detection. |
| 8.5 | Open | Improve Docker health fidelity by checking the same nginx-served path users depend on plus one safe internal API reachability check | Runtime health | Docker health fidelity | 3 | 4 | 2 | Current healthcheck proves `/api/service-status` answers, but that endpoint is hardcoded green and does not prove route dispatch or dependency state. |
| 7.1 | Guardrail | Add a CI test that parses compose `ports:` and rejects app-facing host bindings other than `127.0.0.1` unless explicitly allowlisted | Ingress security | Origin exposure stays closed | 2 | 5 | 2 | The port exposure is closed now, but a cheap regression test would protect the north-star boundary. Impact is capped because the metric is already closed. |
| 7.1 | Open | Make operator status taxonomy explicit: runtime liveness, data readiness, public ingress, and dependency degradation must not be collapsed into one green or red status | Runtime health | Alert accuracy | 2 | 5 | 2 | The repo intentionally treats `/api/health` as data readiness, but operators can still confuse it with container liveness. |
| 6.9 | Open | Add a browser-session-safe bootstrap availability probe that reports aggregate tier availability without minting sessions or dumping payloads | Runtime health | Core UI hydration health | 3 | 4 | 3 | Parent runtime probes could not check authenticated bootstrap safely; an aggregate endpoint would close that gap. |
| 6.9 | Open | Surface compact-health dependency categories in the UI or status surface without exposing unauthenticated internals | Dependency degradation | Safe visible degradation | 3 | 4 | 3 | Users and operators need to see stale or empty dependency classes without exposing upstream details or secret-backed checks. |
| 6.0 | Gap | Add `wm.sacud.com` to the sanctioned research fetch allowlist or provide an equivalent read-only public smoke mechanism | Ingress security | Public ingress validation coverage | 2 | 3 | 1 | Current workers cannot validate the public HTTPS path through the approved helper. |
| 5.7 | Open | Decide AIS behavior when `AISSTREAM_API_KEY` is absent: make AIS explicitly optional/degraded or keep env pass-through as a required deployment invariant | Dependency degradation | AIS relay health | 2 | 4 | 2 | The live relay is reported healthy when the key is passed through, but source still exits when the key is absent. Impact is capped unless bundled with deployment verification. |
| 5.7 | Backlog | Add a non-secret ingress audit runbook or script that reports listener scope, local health, public negative TCP probe, and optional privileged NAT state | Ingress security | Origin exposure detection | 2 | 4 | 2 | Useful operator evidence, but it detects rather than remediates exposure. |
| 4.6 | Backlog | Triage compact-health critical checks into seed-bundle and API-owner buckets and connect them to seed run outcome reporting | Dependency degradation | Local health critical count | 2 | 4 | 3 | Diagnostic alone; it only moves the metric when bundled with seed or source fixes. |

## Closed Or Superseded Items

| Item | Status | Evidence |
| --- | --- | --- |
| Rebind worldmonitor Docker port to `127.0.0.1` | Shipped operationally | Loop signal records 2026-07-05 remediation; fresh external TCP to `91.99.197.46:3010` fails; compose binds `127.0.0.1:${WM_PORT:-3000}:8080`. |
| Fix worldmonitor healthcheck target from `localhost` ambiguity to `127.0.0.1` in compose | Shipped operationally | Loop signal reports Docker healthy after the override; current compose healthcheck uses `http://127.0.0.1:8080/api/service-status`. |
| Pass relay shared secret through Docker services | Shipped operationally | Loop signal reports `worldmonitor-ais-relay` healthy after relay secret pass-through; current compose requires `RELAY_SHARED_SECRET` for app, relay, and seeders. |

## Conflict Resolution

Ingress security now scores lower than the seed because the exposure metric has
moved from open to closed. Runtime health and dependency degradation now point
to the same top milestone: `service-status` should remain safe for liveness but
must stop hiding aggregate unhealthy data readiness. Redis, AIS, and public
HTTPS validation remain important but are second-order until the green status
surface reflects the unhealthy dependency state.
