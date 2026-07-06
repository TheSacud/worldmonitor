# Security and Rollback Guardrail Review

Date: 2026-07-06

## Scope

This review covers repository-visible controls for read-only diagnosis, production
deployment, rollback, permission boundaries, and secret handling. It is based on
source files in this worktree only. No `.env` files, root `data/`, database
files, logs, production dashboards, or private runtime state were read.

Codebase-memory lookup was attempted first with project
`home-hermes-workspaces-worldmonitor`, but that project is not indexed on this
host. The review therefore falls back to read-only workspace inspection.

## Evidence Reviewed

- `ARCHITECTURE.md`: deployment topology and CI/CD ownership table.
- `.github/workflows/*.yml`: PR checks, deploy gate, dependency audit, Convex
  deploy, Cloudflare Worker deploy, and release image publishing.
- `.husky/pre-push`: local pre-push safety gates.
- `scripts/check-local-secret-dumps.mjs`: local plaintext Vercel env dump guard.
- `vercel.json` and `scripts/vercel-ignore.sh`: Vercel routing, headers, and
  ignored-build behavior.
- `docs/api-key-deployment.mdx`: API key and local env dump guidance.
- `docs/health-endpoints.mdx`: health endpoint auth and alerting behavior.
- `docs/railway-seed-consolidation-runbook.md`: Railway seed migration and
  narrow rollback guidance.
- `docs/methodology/energy-v2-flag-flip-runbook.md`: feature-flag rollback
  example for one resilience scoring migration.

## Existing Guardrails

- The architecture document requires updates in the same PR when deployment
  topology, API surface, desktop runtime, or bootstrap keys change.
- PR workflow coverage includes typecheck, lint, test, dependency audit, and a
  deploy-gate status that aggregates required smoke-gate jobs.
- Most GitHub Actions jobs use restricted repository permissions such as
  `contents: read`; publish and deploy jobs grant write permissions only where
  needed.
- The contributor-trust workflow explicitly avoids checking out untrusted fork
  code under `pull_request_target`, which reduces GitHub Actions token exposure.
- The pre-push hook checks for forbidden local Vercel env dump filenames,
  validates branch state, guards against branch contamination, and runs scoped
  type, lint, bundle, proto, markdown, and test gates.
- `scripts/check-local-secret-dumps.mjs` blocks `.env.vercel-backup` and
  `.env.vercel-export` in the repository root and directs operators to rotate
  exposed production secrets through vendor dashboards.
- The PR template has a "No API keys or secrets committed" checkbox.
- `vercel.json` sets security headers including HSTS, `nosniff`,
  `X-Frame-Options`, Permissions Policy, and CSP for the main app and embed
  surfaces.
- Detailed `/api/health` output requires an operator or enterprise API key;
  public compact health is intended for uptime and keyword monitoring.
- Several feature-specific docs include rollback examples, such as the Railway
  seed bundle migration and the energy-v2 feature flag rollback.

## Missing Or Incomplete Guardrails

### Rollback

There is no single production rollback runbook covering the full deployment
surface. Rollback instructions exist for individual features, but not for a
cross-service incident involving Vercel web/API, Vercel env changes, Cloudflare
Worker CORS, Convex backend deploys, Railway seed or relay services, GHCR image
publishing, and desktop releases.

Risk: operators may improvise during an incident, skip dependency order, or
verify with the wrong signal. This matters because `/api/health` returns `200`
for degraded and unhealthy data states except Redis-down, so rollback
verification must inspect the JSON verdict, not just HTTP status.

Minimum guardrail:

- Define each surface owner, rollback mechanism, required approval, and
  verification signal.
- Include "read-only first" diagnostics and explicitly list forbidden reads:
  secrets, `.env`, raw databases, private state, and logs that may contain
  credentials.
- Include post-rollback checks for compact health body status, operator-only
  health when credentials are already available to an approved operator, variant
  smoke checks, seed freshness, and error-reporting dashboards.
- Include a clear "do not rollback" branch for data-source degradation where
  cached last-good data and health alerting are behaving as designed.

### Deploy Approval

Production deploys are mostly merge-driven or manual-dispatch driven. Convex
deploys run on push to `main`, Cloudflare Worker deploys run on push to `main`
for worker path changes or manual dispatch, and Vercel deploy behavior is
controlled outside the repository plus `scripts/vercel-ignore.sh`.

Risk: a merged PR can trigger production effects without a repository-visible
operator approval record for high-risk categories such as auth, payments,
API-key gates, rate limits, CORS, worker routing, data deletion, or env-var
changes.

Minimum guardrail:

- Add a production deployment approval policy for high-risk changes.
- Use GitHub Environments or an equivalent protected deployment mechanism for
  production deploy jobs that hold cloud credentials.
- Document how Vercel production deploy protection is configured, since that
  state is not visible in the repository.
- Extend the PR template with a production impact and rollback checklist.

### Permission Boundaries

The repo documents several least-privilege CI permissions, but it does not carry
a production access matrix. There is no repository-visible list of which human
or automation roles may write to Vercel, Railway, Cloudflare, Convex, Upstash,
GHCR, GitHub environments, or domain/DNS settings.

Risk: autonomous or semi-autonomous maintenance can know that PR-only is
intended without knowing which production credentials are forbidden, which roles
are read-only, or what break-glass approval is required.

Minimum guardrail:

- Add a non-secret access matrix with service, allowed write roles, read-only
  roles, credential storage location by vendor name only, approval requirement,
  and emergency contact path.
- Document that worker agents may prepare PRs and draft handoffs only, and must
  not mutate production, restart services, deploy, run Docker against production,
  or use broad sudo.
- Track periodic access review as a dated checklist without listing credential
  values.

### Secret Handling

Local Vercel env dump detection is a good control, and docs explain that exposed
keys should be rotated. The missing piece is an operational secret inventory and
rotation/incident runbook. The repository also has multiple docs with env-var
setup examples, but no single place that defines safe handling expectations for
operators and automation.

Risk: a suspected leak can turn into ad hoc vendor-by-vendor decisions, and
workers may know not to commit secrets while still lacking guidance for
redaction, evidence collection, rotation order, and follow-up validation.

Minimum guardrail:

- Maintain a non-secret inventory of secret classes and owning vendors, for
  example Vercel app env, Convex deploy key, Cloudflare Worker token, Upstash,
  payment/auth, LLM providers, telemetry, and data providers.
- Define rotation order for suspected exposure, prioritizing credentials that
  write data, deploy code, access customer/payment/auth systems, or unlock Redis.
- Require incident notes to record which credential classes were rotated without
  copying values.
- Add a short automation policy: never read `.env`, env exports, DB files, raw
  logs, browser profiles, keychains, or private state unless a human explicitly
  approves a narrowly scoped incident step.

## Follow-Up Cards

### Card 1: Add Production Rollback Runbook

Title: `Document worldmonitor production rollback runbook`

Acceptance criteria:

- Add a repository runbook for Vercel, Cloudflare Worker, Convex, Railway,
  Upstash-backed seed state, GHCR image publishing, and desktop releases.
- For each surface, document rollback trigger, exact operator role required,
  read-only diagnostics, rollback action, post-rollback verification, and
  "do not rollback" cases.
- Verification uses `/api/health?compact=1` body status, seed-health where
  appropriate, variant smoke checks, and service-specific status signals.
- No secrets, private URLs, tokens, dashboard-only values, or raw logs are
  committed.

### Card 2: Gate High-Risk Production Deploys

Title: `Add explicit approval guardrails for high-risk production deploys`

Acceptance criteria:

- Define high-risk categories: auth, payments, API-key validation, CORS/Worker,
  rate limits, cache purge, data deletion, production env changes, and deploy
  workflows.
- Require protected GitHub Environment approval or equivalent for deploy jobs
  that use production credentials.
- Document the Vercel production deployment protection setting in repo docs
  without exposing project secrets.
- Update the PR template with production impact, approval, and rollback fields.

### Card 3: Create Production Access Matrix

Title: `Document non-secret production access and permission matrix`

Acceptance criteria:

- Add a non-secret table for Vercel, Railway, Cloudflare, Convex, Upstash, GHCR,
  GitHub environments, DNS/domain, auth, payment, telemetry, and LLM/data
  providers.
- For each service, list allowed write roles, read-only roles, credential owner,
  approval path, and break-glass path without credential values.
- Include worker-agent boundaries: PR-only, no production mutation, no service
  restart, no deploy, no broad sudo, no secret/private-state reads.
- Add a dated quarterly access-review checklist.

### Card 4: Add Secret Rotation And Evidence Runbook

Title: `Add secret rotation and leak-response runbook`

Acceptance criteria:

- Document credential classes, rotation owner, rotation order, and validation
  checks without recording values.
- Include a redaction policy for PRs, incident notes, screenshots, logs, and
  terminal output.
- Require follow-up validation after rotation: deploy health, auth/payment
  smoke, data seed freshness, and dependency on vendor dashboards where needed.
- Link the existing local env dump guard and clarify that `.env.vercel-backup`
  and `.env.vercel-export` must be deleted and treated as exposed if found.

### Card 5: Add Read-Only Diagnostic Playbook For Automation

Title: `Document read-only automation diagnostics for worldmonitor`

Acceptance criteria:

- Define allowed first-pass diagnostics: git status/log, repo docs, CI config,
  public compact health, and source files needed for the task.
- Define forbidden reads: `.env*`, root `data/`, DB files, raw logs, browser or
  keychain state, vendor dashboard exports, and private runtime state.
- Define escalation language for restricted actions, including the exact human
  approval needed before production mutation or secret access.
- Add a PR handoff template section for tests run, files changed, residual risk,
  and follow-up cards.
