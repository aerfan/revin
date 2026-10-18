# Revin - Claude Code Guidelines & Workspace Context

Welcome to **Revin**. This document provides Claude Code with essential operational commands and non-negotiable guardrails.

> **Canonical Specification**: For the complete architectural blueprint, detailed layer boundaries, database schemas, and security penetration protocols, refer to [`GEMINI.md`](GEMINI.md).

---

## 1. Quick Reference Commands

- `npm start` / `npm run dev`: Start local dev server at `http://127.0.0.1:3000`.
- `npm run test:canary`: Execute all 8 Canary test suites in sequence.
- `npm run test:security`: Run automated penetration suite (10 attack vectors).
- `npm run test:engine`: Run calculations, commercials, margins, and 5,754 fuzz assertions.
- `npm run test:ui`: Run full Playwright UI automation, QA flows, and a11y audits.
- `npm run build`: Compile standalone web application into `dist-web/index.html` and `dist-web/sw.js`.
- `node build.js`: Compile legacy single-file bundle into `dist/`.

---

## 2. Non-Negotiable Engineering Standards

1. **Dual-Track Branching (Canary First)**:
   - Active staging branch is `canary` (deploys to `https://revin-canary.vercel.app`).
   - Production branch is `main` (deploys to `https://revin-alpha.vercel.app`).
   - All features, refactors, and tests must be committed on `canary`. Never commit directly to `main` or deploy to production without explicit confirmation.
   - Deploy canary previews: `npx vercel deploy --yes && npx vercel alias set <url> revin-canary.vercel.app`.

2. **100% Test Pass Gatekeeper**:
   - Always run `npm run test:engine`, `npm run test:security`, and `npm run test:canary` before committing. Zero failures allowed.

3. **Design System & Icons**:
   - Strictly use **Phosphor Icons** (`@phosphor-icons/core`) with the 256×256 viewBox system (regular outline for standard UI controls, duotone for service categories).

4. **Commercial Privacy in Client Presentation Mode**:
   - Strictly isolate billable rates from internal agency cost rates (`costRate`).
   - When `.clean-mode` / Presentation Mode is active, internal margins, cost rates, and internal notes must NEVER exist in the DOM or client exports.

5. **Defense-in-Depth Security Protocols**:
   - **OWASP CWE-1236 (CSV Injection)**: Escape formula triggers (`=`, `+`, `-`, `@`, `|`) with `'` in `src/engine.js`.
   - **OWASP CWE-1321 (Prototype Pollution)**: Filter `__proto__`, `constructor`, `prototype` in `src/ui/files.js`.
   - **OWASP CWE-22 (Server Confinement)**: Validate paths with `path.relative` and bind to `127.0.0.1` (SEC-01).
   - **Atomic Data Operations**: Enforce pre-flight validation and snapshot rollback on backup imports (FUNC-01).
   - **Strict Build Gates**: Fail closed (`process.exit(1)`) on missing backend credentials in CI/Vercel (OPS-01).
   - **CSP Hardening**: Lock `script-src` to `'self' 'unsafe-inline'` without external CDNs (SEC-03).
   - **Responsive & Accessible**: Maintain 0px horizontal overflow at 320px (A11Y-02) and dynamic `aria-label` on nav buttons (A11Y-01).

6. **Parallel Agent Worktrees**:
   - Run parallel agent tasks in isolated git worktrees:
     ```sh
     git worktree add ../revin-<task> canary
     ```

7. **Git Discipline**:
   - Write clear, human-readable conventional commits (`feat:`, `fix:`, `refactor:`, `docs:`, `test:`).
   - Always push commits immediately to GitHub (`git push origin <branch>`).
