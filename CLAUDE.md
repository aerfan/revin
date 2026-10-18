# Revin - Claude Code Guidelines & Workspace Context

Welcome to the **Revin** codebase.

## Quick Reference Commands
- `npm start` / `npm run dev`: Start local dev server at `http://localhost:3000`.
- `npm run test:engine`: Run calculations, exports, actual hours, and fuzz assertions (5,700+ checks).
- `node test/canary.compat.js`: Run Chromium and WebKit compatibility suite.
- `node test/canary.screens.js`: Run 12 viewport responsive sweeps (320px to 2560px).
- `node test/canary.stress.js`: Run 500-estimate stress tests and click storm benchmarks.
- `node test/canary.telemetry.js`: Run telemetry, breadcrumb, and health panel assertions.
- `npm run test:ui`: Run full Playwright E2E checks, QA flows, accessibility audits, and responsive tests.
- `npm run build`: Build the standalone web app into `dist-web/index.html`.
- `node build.js`: Build the legacy single-file bundle into `dist/`.

## Architecture & Layer Boundaries
- `src/engine.js`: Pure mathematical calculations, estimates, phase logic, financials, and exports. 100% deterministic, zero DOM dependencies.
- `src/app.js`: Interactive UI application (Preact + htm).
- `src/styles.css`: Complete responsive design system with light/dark theme variables.
- `web/runtime.js`: Supabase real-time sync, auth, document hierarchy, and profile adapter.
- `web/build.js`: Standalone single-page bundler generating `dist-web/index.html`.
- `supabase/migrations/`:
  - `0001_init.sql`: Base tables (`docs`, `members`, `invites`), team functions, RLS policies.
  - `0002_security_hardening.sql`: Database constraints (256 KiB size limit, valid regex paths), `trg_docs_integrity` trigger, search_path isolation, admin lockout prevention.
  - `0003_observability.sql`: `public.error_logs` table, deduplication RPC (`log_client_error`), admin-only RLS policies.
- `CANARY_CHANGELOG.md`: Continuous issue log, test cycle reports, and canary release records.

## Strict Engineering Standards for All AI Agents
1. **Branching Model (Canary First)**:
   - Production branch is `main` (deployed at `https://revin-alpha.vercel.app`).
   - Staging/Canary branch is `canary` (deployed at `https://revin-canary.vercel.app`).
   - All new features and refactors MUST be developed on `canary` (or feature branches off `canary`).
   - Deploy Canary preview via `npx vercel deploy --yes && npx vercel alias set <url> revin-canary.vercel.app`.
   - Never merge to `main` without explicit human confirmation.
2. **Design System & Icons**:
   - Always use **Phosphor Icons** (`@phosphor-icons/core`) for all icons across the application (regular outline for standard UI actions/controls, duotone for service categories and tiles, using the 256×256 viewBox system).
3. **Testing Gatekeeper**:
   - Run `npm run test:engine` and `npm run test:ui` before finalizing any changes. All tests must pass (100%).
4. **Human-Readable Commits & Remote Sync**:
   - Follow conventional commits with human-readable descriptions (e.g. `feat(observability): ...`, `fix(stepper): ...`).
   - Push every commit to GitHub (`git push origin <branch>`) so the remote repository is always in sync.
5. **Observability & Health Diagnostics**:
   - Telemetry tracks user action breadcrumbs and fingerprints errors to `dhe:error_logs` and `public.error_logs`.
   - Use the **Copy for AI** button in Settings -> Health & Diagnostics for 1-click Markdown error payloads during triage.
6. **Vercel & Supabase Production Resilience**:
   - Do not place `frame-ancestors` in `<meta>` tags (CSP HTTP headers only).
   - Maintain `Cross-Origin-Opener-Policy: same-origin-allow-popups` for Google OAuth.
7. **Parallel Agent Worktrees**:
   - When running parallel agent tasks, create an isolated worktree:
     `git worktree add ../revin-<task> canary`
