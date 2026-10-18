# Revin - Project Guidelines & Workspace Context

Welcome to the **Revin** workspace in Google Antigravity.

## Workspace Overview
- **Project Name:** Revin
- **Repository Root:** `/Users/arfan/Documents/Revin`
- **Primary Production Branch:** `main` (Deploys to `https://revin-alpha.vercel.app`)
- **Canary / Staging Branch:** `canary` (Deploys to `https://revin-canary.vercel.app`)
- **CI/CD:** GitHub Actions configured under `.github/workflows/ci.yml`

## Project Structure & Layer Architecture
- `src/engine.js`: Pure mathematical calculations, estimates, phase logic, commercials (blended cost rate, gross profit, margin %, milestones), and exports. 100% deterministic, zero DOM dependencies.
- `src/ui/`: Modular UI application layer partitioned into 14 domain-specific components:
  - `header.js`, `icons.js`, `telemetry.js`, `helpers.js`, `components.js`, `files.js`, `navigation.js`.
  - Views: `views/estimates.js`, `views/editor.js`, `views/advanced.js`, `views/library.js`, `views/settings.js`.
  - Core: `app-core.js`, `boot.js`.
- `dev/bundle-ui.js`: High-speed zero-dependency assembler that compiles `src/ui/` into `src/app.js` during build time.
- `src/styles.css`: Complete responsive design system (light/dark theme, fluid typography, mobile safe areas, clean presentation mode, `@media print`).
- `web/runtime.js`: Supabase real-time sync, auth, document hierarchy, and profile adapter.
- `web/sw.js`: PWA Service Worker providing Cache-First static asset caching and offline resilience.
- `web/build.js`: Standalone single-page bundler generating `dist-web/index.html` and copying `dist-web/sw.js`.
- `build.js`: Standalone local bundler generating `dist/design-hours-estimator.html`.
- `supabase/migrations/`:
  - `0001_init.sql`: Base tables (`docs`, `members`, `invites`), team functions, RLS policies.
  - `0002_security_hardening.sql`: Database-level constraints (256 KiB doc size, valid regex paths), `trg_docs_integrity` trigger, search_path isolation, admin lockout prevention.
  - `0003_observability.sql`: `public.error_logs` table, deduplication RPC (`log_client_error`), admin-only RLS policies.
- `CANARY_CHANGELOG.md`: Continuous issue log, test cycle reports, and canary release records.
- `Inspirations/`: UI/UX references and design benchmarks.

## Antigravity Agent Guidelines & Engineering Standards
- **Dual-Track Branching (Canary First)**:
  - Build and stabilize all new features, refactors, and experiments on the `canary` branch (or feature branches branched off `canary`).
  - Deploy to the Canary preview environment (`npx vercel deploy --yes && npx vercel alias set <url> revin-canary.vercel.app`) for user review.
  - Never merge to `main` or deploy to production without explicit user confirmation.
- **Testing & Local Verification**:
  - Always run contract tests locally before finalizing any commit:
    - `npm run test:canary`: Runs all 8 Canary test suites in sequence.
    - `npm run test:security`: Automated penetration suite (CSV injection, prototype pollution, XSS, commercial leakage, boundary overflows, ReDoS).
    - `npm run test:engine`: 5,754 unit & fuzz checks, calculations, margin models, milestone schedules.
    - `node test/canary.compat.js`: Chromium & WebKit compatibility.
    - `node test/canary.screens.js`: 12 viewport sweeps (320px to 2560px).
    - `node test/canary.stress.js`: 500-estimate load, rapid concurrency, and 1,000-estimate extreme benchmarks.
    - `node test/canary.telemetry.js`: Telemetry & health diagnostics verification.
    - `node test/canary.proposal.js`: Interactive proposal portal, presentation mode, tier switching, digital sign-off, certificate seal, and revocation.
    - `node test/canary.security.js`: Penetration checks across all 10 vulnerability surfaces.
    - `node test/canary.webhook.js`: Post-acceptance webhooks, Slack BlockKit formatting, and outbound automation contracts.
    - `npm run test:ui`: 53 UI automation checks, 42 QA scenarios, 28 axe audits, 143 responsive width checks.
  - All checks must pass (100%) with zero errors before finalizing any commit.
- **Outbound Webhooks & Post-Acceptance Automation (Phase 1)**:
  - Digital proposal acceptance triggers outbound webhook payloads (`proposal.accepted`) carrying full commercial financials, milestones, and client signature data.
  - Automatic Slack/Discord BlockKit card formatting when endpoint matches `hooks.slack.com` or `discord.com`.
  - All webhooks strictly enforce HTTPS protocols and execute non-blocking via `AbortController` timeouts (8000ms).
- **Security, Audit Remediation & Penetration Hardening**:
  - Always guard against CSV Formula & DDE injection in export routines (OWASP CWE-1236). Neutralize formula triggers (`=`, `+`, `-`, `@`, `|`) with single quote prefixing and quote cells containing tabs or semicolons.
  - Guard recursive object merges against Prototype Pollution (`__proto__`, `constructor`, `prototype`) (OWASP CWE-1321).
  - Enforce strict input bounds, regex verification, and text escaping across all user inputs and digital sign-off flows.
  - Development Server Path Confinement (SEC-01): Guard development server against sibling directory traversal and escapes using `path.relative` validation and bind to `127.0.0.1`.
  - Atomic Data Operations (FUNC-01): Pre-flight validate path formats (even segments, <= 8) and 256 KiB size limits; maintain pre-import snapshots and execute automatic rollbacks on mid-flight failure.
  - Build Pipeline Configuration Gate (OPS-01): Fail closed with `process.exit(1)` in CI/Vercel/strict builds if required Supabase backend variables are missing.
  - CSP Hardening (SEC-03): Keep `script-src` locked to `'self' 'unsafe-inline'` (no external CDNs) and scope `connect-src` strictly to project domain.
- **Human-Readable Git Discipline & Remote Sync**:
  - Write clear, descriptive conventional commits (e.g. `feat(observability): ...`, `fix(stepper): ...`, `refactor(ui): ...`, `feat(proposal): ...`).
  - Always explain the rationale and component scope in the commit message.
  - Push every commit directly to GitHub (`git push origin <branch>`) so the remote repository is always up to date.
- **Commercials, Privacy & Proposals**:
  - Maintain strict separation between client-facing billable rates and internal agency cost rates (`costRate`).
  - When `.clean-mode` / Presentation Mode is active, NEVER leak internal margin figures, cost rates, or internal notes into the DOM.
  - Proposal digital acceptances are sealed into immutable acceptance metadata; modifications require explicit estimator revocation.
- **Design System & Icons**:
  - Always use **Phosphor Icons** (`@phosphor-icons/core`) for all icons across the application (regular outline for standard UI actions/controls, duotone for service categories and tiles, using the 256×256 viewBox system).
- **Observability & Error Handling**:
  - Capture client crashes and runtime anomalies via `Telemetry.record(err, context)` and `window.RevinTelemetry`.
  - Maintain the 15-event circular breadcrumbs buffer on state/view transitions.
  - In Settings, the **Health & Diagnostics** card displays live status and provides a 1-click **Copy for AI** button formatted in Markdown for immediate agent triage.
- **Vercel & Supabase Production Resilience**:
  - Never place `frame-ancestors` in `<meta http-equiv="Content-Security-Policy">`; it must strictly reside in HTTP headers in `vercel.json`.
  - Ensure COOP headers allow popup authentication: `Cross-Origin-Opener-Policy: same-origin-allow-popups`.
  - Protect database tables with PostgreSQL constraints against PostgREST direct payload abuse.
  - Service worker `sw.js` must be served with `no-cache, no-store, must-revalidate` and excluded from SPA rewrite rules.
- **Multi-Agent Coexistence & Git Worktrees**:
  - Revin is engineered for parallel AI agent development (Google Antigravity, Claude Code, Cursor, ChatGPT Codex).
  - Guidelines are mirrored in `GEMINI.md`, `CLAUDE.md`, `.cursorrules`, and `.github/copilot-instructions.md`.
  - Use Git Worktrees (`git worktree add ../revin-<task> canary`) for isolated parallel AI agent execution without directory or file locks.
