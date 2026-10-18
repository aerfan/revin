# Revin - Project Guidelines & Workspace Context

Welcome to the **Revin** workspace in Google Antigravity.

## Workspace Overview
- **Project Name:** Revin
- **Repository Root:** `/Users/arfan/Documents/Revin`
- **Primary Production Branch:** `main` (Deploys to `https://revin-alpha.vercel.app`)
- **Canary / Staging Branch:** `canary` (Deploys to `https://revin-canary.vercel.app`)
- **CI/CD:** GitHub Actions configured under `.github/workflows/ci.yml`

## Project Structure & Layer Architecture
- `src/engine.js`: Pure mathematical calculations, estimates, phase logic, and exports. 100% deterministic, zero DOM dependencies.
- `src/app.js`: Interactive UI application (Preact + htm).
- `src/styles.css`: Complete responsive design system.
- `web/runtime.js`: Supabase real-time sync, auth, documents, and profile adapter.
- `web/build.js`: Standalone single-page bundler generating `dist-web/index.html`.
- `supabase/migrations/`: PostgreSQL schemas, RLS security policies, and database triggers.
- `Inspirations/`: UI/UX references and design benchmarks.

## Antigravity Agent Guidelines & Engineering Standards
- **Dual-Track Branching (Canary First)**:
  - Build and stabilize all new features and experiments on the `canary` branch (or feature branches branched off `canary`).
  - Deploy to the Canary preview environment (`npx vercel deploy && npx vercel alias set <url> revin-canary.vercel.app`) for user review.
  - Never merge to `main` or deploy to production without explicit user confirmation.
- **Testing & Local Verification**:
  - Always run contract tests locally (`npm run test:engine` and `npm run test:ui`) and ensure all checks pass (100%) before finalizing any commit.
- **Automatic Commit & Remote Sync**:
  - Follow Git conventional commits (e.g. `feat:`, `fix:`, `chore:`, `docs:`, `ci:`).
  - Push every commit directly to GitHub (`git push origin <branch>`) so the remote repository is always up to date.
- **Design System & Icons**:
  - Always use **Phosphor Icons** (`@phosphor-icons/core`) for all icons across the application (regular outline for standard UI actions/controls, duotone for service categories and tiles, using the 256×256 viewBox system).
- **Multi-Agent Coexistence**:
  - Revin is engineered for parallel AI agent development (Google Antigravity, Claude Code, Cursor, ChatGPT Codex).
  - Guidelines are mirrored in `GEMINI.md`, `CLAUDE.md`, `.cursorrules`, and `.github/copilot-instructions.md`.
  - Use Git Worktrees (`git worktree add ../revin-<task> canary`) for isolated parallel AI agent execution without directory or file locks.

