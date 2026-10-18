# Revin - Claude Code Guidelines & Workspace Context

Welcome to the **Revin** codebase.

## Quick Reference Commands
- `npm start` / `npm run dev`: Start local dev server at `http://localhost:3000`.
- `npm run test:engine`: Run calculations, exports, actual hours, and fuzz assertions (5,700+ checks).
- `npm run test:ui`: Run Playwright E2E checks, accessibility audits, and responsive tests.
- `npm run build`: Build the standalone web app into `dist-web/index.html`.
- `node build.js`: Build the legacy single-file bundle into `dist/`.

## Architecture & Layer Boundaries
- `src/engine.js`: Pure mathematical calculations, estimates, phase logic, and exports. 100% deterministic, zero DOM dependencies.
- `src/app.js`: Interactive UI application (Preact + htm).
- `src/styles.css`: Complete responsive design system.
- `web/runtime.js`: Supabase real-time sync, auth, documents, and profile adapter.
- `web/build.js`: Standalone single-page bundler generating `dist-web/index.html`.
- `supabase/migrations/`: PostgreSQL schemas, RLS security policies, and database triggers.

## Strict Engineering Standards for All AI Agents
1. **Branching Model**:
   - Production branch is `main` (deployed at `https://revin-alpha.vercel.app`).
   - Staging/Canary branch is `canary` (deployed at `https://revin-canary.vercel.app`).
   - All new features and refactors MUST be developed on `canary` (or feature branches off `canary`).
   - Never merge to `main` without explicit human confirmation.
2. **Design System & Icons**:
   - Always use **Phosphor Icons** (`@phosphor-icons/core`) for all icons across the application (regular outline for standard UI actions/controls, duotone for service categories and tiles, using the 256×256 viewBox system).
3. **Testing Gatekeeper**:
   - Run `npm run test:engine` and `npm run test:ui` before finalizing any changes. All tests must pass (100%).
4. **Git Discipline**:
   - Conventional commits (`feat:`, `fix:`, `chore:`, `docs:`).
   - Push commits to GitHub (`git push origin <branch>`) so the remote repository is always in sync.
5. **Parallel Agent Worktrees**:
   - When running parallel agent tasks, create an isolated worktree:
     `git worktree add ../revin-<task> canary`
