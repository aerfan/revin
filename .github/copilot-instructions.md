# GitHub Copilot & Codex Instructions for Revin

## Repository Overview
Revin is an enterprise design-hours estimation and commercial proposal platform for digital agencies. It features a shared CMS of pages, features, and starter packs, real-time Supabase collaborative editing, multi-currency financials with internal cost rate and gross margin modeling, an interactive client proposal portal with selectable tiers and digital sign-off, version diffs, PWA offline caching, and automated client observability.

## Key Engineering Rules
- **Branching**: All work happens on the `canary` branch unless explicitly instructed to patch `main`. Preview deploys to `https://revin-canary.vercel.app`. Never touch `main` without human confirmation.
- **Architecture**:
  - `src/engine.js`: Pure mathematical calculations, margin models, milestone schedules. Zero DOM code.
  - `src/ui/`: 14 modular components (`header.js`, `icons.js`, `telemetry.js`, `helpers.js`, `components.js`, `files.js`, `navigation.js`, `views/*`, `app-core.js`, `boot.js`).
  - `dev/bundle-ui.js`: High-speed zero-dependency assembler compiling `src/ui/` into `src/app.js`.
  - `web/sw.js`: PWA service worker with Cache-First static asset caching.
- **Icons**: Always use Phosphor Icons (`@phosphor-icons/core`) with a 256×256 viewBox (regular outline for standard controls, duotone for service categories).
- **Commercials & Proposals**: Strict separation between billable rates and internal cost rates. In `.clean-mode` / Presentation Mode, internal margins and cost rates must never appear in the DOM. Digital proposal acceptances are immutable once signed.
- **Observability**: Use `Telemetry.record(err, context)` and breadcrumb tracking. Errors are reported in Settings with 1-click "Copy for AI" markdown.
- **Security, Privacy & Webhooks**: Always sanitize CSV formula triggers (`=`, `+`, `-`, `@`, `|` prefixed with `'`), guard object merging against prototype pollution, bound user input strings, suppress internal margins in client mode, and enforce strict HTTPS protocols on outbound webhook automation.
- **Verification**: Always execute `npm run test:engine`, `npm run test:security`, `npm run test:canary`, and `npm run test:ui` before committing (100% pass required).
- **Commits**: Use human-readable conventional commits (`feat:`, `fix:`, `refactor:`, `docs:`) and push to remote immediately.
