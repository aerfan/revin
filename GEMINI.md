# Revin - Project Guidelines & Workspace Context

Welcome to the **Revin** workspace in Google Antigravity.

## Workspace Overview
- **Project Name:** Revin
- **Repository Root:** `/Users/arfan/Documents/Revin`
- **Primary Branch:** `main`
- **CI/CD:** GitHub Actions configured under `.github/workflows/ci.yml`

## Project Structure
- `.github/workflows/`: CI/CD automation pipelines.
- `Inspirations/`: UI/UX references and design benchmarks (ClickUp web layouts, dashboard mockups).
- `GEMINI.md`: Antigravity workspace instructions and context.
- `README.md`: Public project documentation and setup guides.

## Antigravity Agent Guidelines
- Maintain clean, modular code with modern best practices.
- Preserve existing documentation and docstrings.
- Follow Git conventional commits (e.g. `feat:`, `fix:`, `chore:`, `docs:`, `ci:`).
- Verify code quality and ensure CI compatibility before finalizing changes.
- **Design System & Icons**: Always use **Phosphor Icons** (`@phosphor-icons/core`) for all icons across the application (regular outline for standard UI actions/controls, duotone for service categories and tiles, using the 256×256 viewBox system).
- **Testing & Local Verification**: Always test changes locally first (`npm run test:engine` and `npm run test:ui`) and ensure all checks pass before finalizing updates.
- **Automatic Commit & Remote Sync**: Whenever building, updating, or improving the application, always create a local Git commit with a descriptive message and push it directly to GitHub (`git push origin <branch>`) so the remote repository is always up to date.
- **Vercel Deployment Confirmation**: After local testing and pushing to GitHub, always ask the user for confirmation before deploying to Vercel production. Once confirmed by the user, deploy the latest changes to Vercel (`npx vercel --prod`).
- **Database Backend**: Revin uses Supabase (PostgreSQL, Auth, and Realtime). Supabase environment variables (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, and optional `AGENCY_NAME`) are required for the web build and live production.

