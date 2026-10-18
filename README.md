# Revin - Design Hours Estimator

A modern web application for estimating design hours from a shared library of pages, features, and sections. Engineered for digital agencies, Revin couples deterministic estimation with commercial financials (internal cost rates, gross margin analysis, milestone payment schedules), an interactive client proposal portal (presentation mode, package tiers, digital sign-off with certificate seals), version diffs, requirements traceability, and actual-hours tracking. Exports include CSV, Excel (with live formulas), Word proposals, and printable PDFs.

It runs on **Supabase** (database, sign-in, live updates) and **Vercel** (hosting). Team members sign in with Google or with email and password. PWA offline caching provides sub-30ms load times.

---

## Deploy (about 20 minutes)

You need a [Supabase](https://supabase.com) account, a [Vercel](https://vercel.com) account and this repository on GitHub. For Google sign-in you also need access to [Google Cloud Console](https://console.cloud.google.com).

### 1. Create the Supabase project

1. In Supabase, click **New project**. Pick a region close to your team and set a database password; you won't need it in the app.
2. Open **SQL Editor** → **New query**. Paste the whole of [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql) and click **Run**. It creates the tables, access rules and team functions. Running it again later is safe.
3. Open **Project Settings → API Keys** and copy two values:
   - the **Project URL** (`https://<ref>.supabase.co`)
   - the **publishable key** (`sb_publishable_…`). On older projects, use the `anon` key instead.

   Both values are designed to be public. The access rules in the database keep the data safe.

### 2. Deploy to Vercel

1. In Vercel, click **Add New → Project** and import this GitHub repository. The settings come from `vercel.json`, so leave the framework as **Other**.
2. Under **Environment Variables**, add:

   | Name | Value |
   |---|---|
   | `SUPABASE_URL` | the Project URL from step 1 |
   | `SUPABASE_ANON_KEY` | the publishable (or anon) key from step 1 |
   | `AGENCY_NAME` | optional, shown on the sign-in screen (e.g. `News9`) |

   If you connect Vercel's Supabase integration instead, it sets `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` for you. The build reads those names too.
3. Click **Deploy**. Note the address, e.g. `https://design-hours-estimator.vercel.app`, or add your own domain under **Settings → Domains**.

### 3. Tell Supabase where the app lives

In Supabase, go to **Authentication → URL Configuration**:

- **Site URL**: your app's address, e.g. `https://estimator.youragency.com`
- **Redirect URLs**: add `https://estimator.youragency.com/**`. Also add the `*.vercel.app` address if you'll use it.

Then go to **Authentication → Sign In / Providers → Email** and keep **Confirm email** on. That way nobody can claim an invited address they don't own.

> Supabase's built-in email sender is rate-limited and meant for testing. Before inviting the whole team, set up your own SMTP under **Authentication → Emails → SMTP Settings** (Resend, Postmark, SES or Google Workspace SMTP all work).

### 4. Turn on Google sign-in

1. In Google Cloud Console, open **APIs & Services → OAuth consent screen**. If your agency uses Google Workspace, choose **Internal** so only your company's accounts can use it.
2. Go to **Credentials → Create credentials → OAuth client ID → Web application**. Under **Authorized redirect URIs**, add the callback URL that Supabase shows on its Google provider page. It looks like `https://<ref>.supabase.co/auth/v1/callback`.
3. Copy the **Client ID** and **Client secret** into Supabase under **Authentication → Sign In / Providers → Google**, and enable it.

### 5. First sign-in and your data

1. Open the app and create an account. **The first account becomes the admin.**
2. Go to **Settings → Backup → Import backup** and choose one of these files:
   - `estimator-backup-from-claude.json`, your library, settings and estimates from the claude.ai version (it's provided separately, not stored in this repo), or
   - [`seed/starter-backup.json`](seed/starter-backup.json), the starter library, if you're starting fresh.
3. Under **Settings → Team**:
   - **Invite** people by email. They sign up at the app's address with that email and get access straight away. No email is sent from the app, so share the link with them yourself.
   - Or set the **company domain**. Anyone who signs in with Google on that domain joins automatically.
   - Everyone else waits under **Waiting for approval** until an admin approves them.

---

## Who can do what

| Role | Estimates | Library & settings | Team |
|---|---|---|---|
| **Admin** | create, edit, delete | edit | invite, approve, change roles, remove |
| **Estimator** | create, edit, delete | read | — |
| **Waiting for approval** / **Removed** | — | — | — |

The database enforces these rules (Postgres row-level security), not only the interface. An estimator cannot change the library, even by calling the API directly. Admins can't demote themselves, so the team always keeps at least one admin.

## How it's built

- `src/ui/`: Modular UI layer partitioned into 14 focused components (`header.js`, `icons.js`, `telemetry.js`, `helpers.js`, `components.js`, `files.js`, `navigation.js`, `views/estimates.js`, `views/editor.js`, `views/advanced.js`, `views/library.js`, `views/settings.js`, `app-core.js`, `boot.js`).
- `dev/bundle-ui.js`: High-speed, zero-dependency assembler that compiles `src/ui/` into `src/app.js` for standalone and web builds.
- `src/engine.js`: Pure mathematical engine for scope calculations, agency commercials (blended cost rates, gross profit margins, payment milestone schedules), package tiers, and deterministic exports. Zero DOM dependencies.
- `src/styles.css`: Complete responsive design system (light/dark themes, fluid typography, mobile safe areas, clean proposal presentation mode, and `@media print` layouts).
- `web/runtime.js`: Supabase real-time sync, auth, document hierarchy, and profile adapter.
- `web/sw.js`: PWA Service Worker implementing Cache-First static asset caching (<30ms repeat loads) and Network-First document sync.
- `web/build.js`: Produces `dist-web/` (one `index.html` plus `/vendor` assets and `sw.js`). Runs on Vercel deploys with CSP header generation.
- `supabase/migrations/`:
  - `0001_init.sql`: Base tables (`docs`, `members`, `invites`, `team_settings`), access rules, sign-up trigger, and team functions.
  - `0002_security_hardening.sql`: PostgreSQL check constraints (256 KiB size limit, valid regex paths), `trg_docs_integrity` trigger, search_path isolation, admin lockout prevention.
  - `0003_observability.sql`: `public.error_logs` table, deduplication RPC (`log_client_error`), admin-only RLS policies.
- `build.js`: Standalone bundler producing the legacy single-file distribution (`dist/design-hours-estimator.html`).

Data is stored as JSON documents addressed by path (`services/website`, `config/settings`, `estimates/{id}`, `estimates/{id}/versions/{id}`), keeping backups and local runners compatible.

## Deployment & Staging Environments

- **Production URL**: [https://revin-alpha.vercel.app](https://revin-alpha.vercel.app) (Deploys strictly from `main`)
- **Canary / Staging URL**: [https://revin-canary.vercel.app](https://revin-canary.vercel.app) (Deploys from `canary` for rapid testing & validation)

## Local development

### Instant local runner (no external dependencies needed):
```sh
npm install
npm start          # builds and opens http://localhost:3000 in your browser
```
This serves the application with your Claude backup data loaded, live local editing, and a data-switcher (Claude Backup, Demo, Worst Case, Empty, 1,000 rows).

### Full standalone Supabase + Vercel development:
```sh
cp .env.example .env.local    # fill in your Supabase URL and key
node web/build.js             # builds dist-web/
npx serve dist-web -s         # or any static server with fallback to index.html
```

Add `http://localhost:3000/**` to the Supabase redirect URLs while developing.

## Tests & Continuous Verification

| Command | What it covers |
|---|---|
| `npm run test:canary` | Runs all Canary test suites across engines, viewports, stress benchmarks, proposal contracts, and security audits |
| `npm run test:security` | Automated penetration suite: CSV formula injection (CWE-1236), prototype pollution (CWE-1321), stored XSS (CWE-79), commercial privacy (CWE-200), boundary overflows, and ReDoS |
| `npm run test:engine` | Pure math calculations, agency financials, margins, milestones, and 5,754 randomised fuzz checks |
| `node test/canary.compat.js` | Cross-browser rendering & interaction contracts on Chromium & WebKit (Safari engine) |
| `node test/canary.screens.js` | 12 responsive viewport sweeps (320px ultra-compact to 2560px QHD Ultrawide) |
| `node test/canary.stress.js` | 500-estimate load benchmarks, rapid stepper click storms, memory stability churn |
| `node test/canary.telemetry.js` | Circular telemetry breadcrumbs, local error persistence, and Settings health diagnostics |
| `node test/canary.proposal.js` | Interactive proposal portal, presentation mode, tier switching, digital sign-off, certificate seal, and revocation |
| `node test/canary.security.js` | Fuzz testing and exploit verification against 6 core web attack vectors |
| `node test/canary.webhook.js` | Post-acceptance webhooks, Slack BlockKit formatting, and outbound automation contracts |
| `npm run test:ui` | Full interface: 53 UI automation checks, 42 QA scenarios, 7 v2 scenarios, 3 F1 scenarios, 28 axe accessibility audits, 143 responsive sweeps |
| `npm run test:db` | The migration on real Postgres: sign-up roles, access rules, path and size limits, ordering, team rules, first-admin race |
| `npm run test:web` | The built standalone app in Chromium against real Postgres and PostgREST with local Auth/Realtime mocks |

The browser tests need Playwright (`npm i -D playwright && npx playwright install chromium`).

## Notes

- **Free Supabase projects pause after a week without use.** Upgrade to Pro for a team tool, or open the app at least weekly.
- **Brief analyzer:** the "Analyze a client brief" feature from the claude.ai version is hidden here. It needs an AI provider and can be added later through a Supabase Edge Function.
- **Backups:** Supabase Pro takes daily backups. **Settings → Backup → Download backup** also gives you a full JSON copy at any time.
