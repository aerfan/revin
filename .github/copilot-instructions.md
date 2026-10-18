# GitHub Copilot & Codex Instructions for Revin

## Repository Overview
Revin is a design-hours estimation tool for agencies featuring a shared library of pages, features, and starter packs, live collaborative editing with Supabase, and automated client proposals.

## Key Instructions
- **Branching**: All work happens on the `canary` branch unless explicitly instructed to patch `main`.
- **Icons**: Always use Phosphor Icons (`@phosphor-icons/core`) with a 256x256 viewBox.
- **Pure Calculations**: Do not introduce DOM APIs or UI dependencies into `src/engine.js`.
- **Verification**: Always execute `npm run test:engine` and `npm run test:ui` to verify changes.
