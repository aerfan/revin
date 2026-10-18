# GitHub Copilot & Codex Instructions for Revin

> **Canonical Specification**: For complete architecture, security penetration protocols, and database schemas, see [`GEMINI.md`](../GEMINI.md).

## Repository Overview
Revin is an enterprise design-hours estimation and commercial proposal platform for digital agencies. It features a shared CMS of pages, features, and starter packs, real-time Supabase collaborative editing, multi-currency financials with internal cost rate and gross margin modeling, an interactive client proposal portal with selectable tiers and digital sign-off, version diffs, PWA offline caching, automated client observability, and outbound webhook automation.

## Key Engineering Rules
- **Branching (Canary First)**: All work happens on the `canary` branch unless explicitly instructed to patch `main`. Preview deploys to `https://revin-canary.vercel.app`. Never touch `main` without human confirmation.
- **Architecture**:
  - `src/engine.js`: Pure mathematical calculations, margin models, milestone schedules. Zero DOM code.
  - `src/ui/`: 14 modular components (`header.js`, `icons.js`, `telemetry.js`, `helpers.js`, `components.js`, `files.js`, `navigation.js`, `views/*`, `app-core.js`, `boot.js`).
  - `dev/bundle-ui.js`: High-speed zero-dependency assembler compiling `src/ui/` into `src/app.js`.
  - `web/runtime.js` & `web/sw.js`: Supabase sync, atomic backup import rollback, and PWA Cache-First caching.
- **Icons**: Always use Phosphor Icons (`@phosphor-icons/core`) with a 256×256 viewBox (regular outline for standard controls, duotone for service categories).
- **Commercials & Proposals**: Strict separation between billable rates and internal cost rates. In `.clean-mode` / Presentation Mode, internal margins and cost rates must never appear in the DOM. Digital proposal acceptances are immutable once signed.
- **Observability**: Use `Telemetry.record(err, context)` and breadcrumb tracking. Errors are reported in Settings with 1-click "Copy for AI" markdown.
- **Security & Hardening**:
  - Sanitize CSV formula triggers (`=`, `+`, `-`, `@`, `|` prefixed with `'` in `src/engine.js`).
  - Guard object merging against prototype pollution (`__proto__`, `constructor`, `prototype` filtered in `src/ui/files.js`).
  - Confine dev server paths (`path.relative` check + loopback host for SEC-01).
  - Execute atomic pre-validated backup imports with snapshot rollback (FUNC-01).
  - Fail strict builds on missing backend config (OPS-01).
  - Maintain tightened CSP without external CDNs (SEC-03).
  - Enforce strict HTTPS protocols on outbound webhook automation.
- **Accessibility & Responsive Reflow**: Ensure all mobile navigation controls expose accessible names (`aria-label`) when labels are hidden (A11Y-01) and maintain 0px horizontal overflow across all viewports down to 320px (A11Y-02).
- **Verification**: Always execute `npm run test:engine`, `npm run test:security`, `npm run test:canary`, and `npm run test:ui` before committing (100% pass required).
- **Commits**: Use human-readable conventional commits (`feat:`, `fix:`, `refactor:`, `docs:`) and push to remote immediately.
