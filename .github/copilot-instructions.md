# GitHub Copilot & Codex Instructions for Revin

## Repository Overview
Revin is a professional design-hours estimation tool for agencies featuring a shared library of pages, features, and starter packs, live collaborative editing with Supabase, multi-currency financials, client proposals in Word/Excel, and automated client observability.

## Key Engineering Rules
- **Branching**: All work happens on the `canary` branch unless explicitly instructed to patch `main`. Preview deploys to `https://revin-canary.vercel.app`.
- **Icons**: Always use Phosphor Icons (`@phosphor-icons/core`) with a 256x256 viewBox.
- **Pure Calculations**: Do not introduce DOM APIs or UI dependencies into `src/engine.js`.
- **Observability**: Use `Telemetry.record(err, context)` and breadcrumb tracking. Errors are reported in Settings with 1-click "Copy for AI" markdown.
- **Verification**: Always execute `npm run test:engine`, `npm run test:ui`, and the `canary.*.js` suites before committing.
- **Commits**: Use human-readable conventional commits (`feat:`, `fix:`, `refactor:`, `docs:`) and push to remote.
