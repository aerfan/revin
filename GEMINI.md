# Revin - Project Guidelines & Workspace Context

Welcome to the **Revin** workspace in Google Antigravity.

## Workspace Overview
- **Project Name:** Revin
- **Repository Root:** `/Users/arfan/Documents/Revin`
- **Primary Production Branch:** `main` (Deploys to `https://revin-alpha.vercel.app`)
- **Canary / Staging Branch:** `canary` (Deploys to `https://revin-canary.vercel.app`)
- **CI/CD:** GitHub Actions configured under `.github/workflows/ci.yml`

## Project Structure & Layer Architecture
- `src/engine.js`: Pure mathematical calculations, estimates, phase logic, financials, and exports. 100% deterministic, zero DOM dependencies.
- `src/app.js`: Interactive UI application (Preact + htm). Modularized into structured subcomponents under `src/modules/` or assembled for high-performance zero-dependency inlining.
- `src/styles.css`: Complete responsive design system (light/dark theme, fluid typography, mobile safe areas).
- `web/runtime.js`: Supabase real-time sync, auth, document hierarchy, and profile adapter.
- `web/build.js`: Standalone single-page bundler generating `dist-web/index.html`.
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
    - `npm run test:engine`: 5,754 unit & fuzz checks.
    - `node test/canary.compat.js`: Chromium & WebKit compatibility.
    - `node test/canary.screens.js`: 12 viewport sweeps (320px to 2560px).
    - `node test/canary.stress.js`: 500-estimate load & rapid concurrency stress tests.
    - `node test/canary.telemetry.js`: Telemetry & health diagnostics verification.
    - `npm run test:ui`: 53 UI automation checks, 42 QA scenarios, 28 axe audits, 143 responsive width checks.
  - All checks must pass (100%) with zero errors before finalizing any commit.
- **Human-Readable Git Discipline & Remote Sync**:
  - Write clear, descriptive conventional commits (e.g. `feat(observability): ...`, `fix(stepper): ...`, `refactor(modules): ...`).
  - Always explain the rationale and component scope in the commit message.
  - Push every commit directly to GitHub (`git push origin <branch>`) so the remote repository is always up to date.
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
- **Multi-Agent Coexistence & Git Worktrees**:
  - Revin is engineered for parallel AI agent development (Google Antigravity, Claude Code, Cursor, ChatGPT Codex).
  - Guidelines are mirrored in `GEMINI.md`, `CLAUDE.md`, `.cursorrules`, and `.github/copilot-instructions.md`.
  - Use Git Worktrees (`git worktree add ../revin-<task> canary`) for isolated parallel AI agent execution without directory or file locks.
