# Revin - Design Hours Estimator

A web app for estimating design hours from a shared library of pages, features and sections. Estimators pick a service, set the scope, tick items with preset hours, and get a reviewed breakdown with overhead, buffer, scope scenarios, phases, packages, versions, requirements traceability and actual-hours tracking. Exports are CSV, Excel (with live formulas) and a client proposal in Word.

It runs on **Supabase** (database, sign-in, live updates) and **Vercel** (hosting). Team members sign in with Google or with email and password.

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

- `src/`: the app (Preact + htm, no build framework). `engine.js` holds the calculations and exports, `app.js` the screens, `styles.css` the design.
- `web/runtime.js`: the standalone layer. It provides the sign-in screens, keeps documents in Supabase through four database functions (`get_doc`, `query_docs`, `set_doc`, `delete_doc`), handles live updates over Supabase Realtime, and supplies user profiles, team management and backups.
- `web/build.js`: produces `dist-web/` (one `index.html` plus the vendored libraries in `/vendor`). It runs on every Vercel deploy and writes a Content Security Policy that only allows your Supabase project.
- `supabase/migrations/0001_init.sql`: the tables (`docs`, `members`, `invites`, `team_settings`), access rules, the sign-up trigger and the team functions.
- `build.js`: builds the claude.ai version of the same app (`dist/`), which is still supported.

Data is stored as JSON documents addressed by path (`services/website`, `config/settings`, `estimates/{id}`, `estimates/{id}/versions/{id}`), which keeps backups and the claude.ai version compatible.

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

## Tests

| Command | What it covers |
|---|---|
| `npm run test:engine` | calculations, exports, actual hours, and 600 randomised estimates |
| `npm run test:db` | the migration on a real Postgres: sign-up roles, access rules, path and size limits, ordering, team rules, a first-admin race (needs Postgres; set `PGHOST`/`PGPASSWORD`) |
| `npm run test:web` | the built standalone app in Chromium, against real Postgres and PostgREST with local stand-ins for Supabase Auth and Realtime: sign-up, invites, approval, Google PKCE, role changes, live sync, reconnects, exports and backups (run `test/web/get-postgrest.sh` first) |
| `npm run test:ui` | the full interface: journeys, QA scenarios, accessibility (axe) and responsive checks |

The browser tests need Playwright (`npm i -D playwright && npx playwright install chromium`).

## Notes

- **Free Supabase projects pause after a week without use.** Upgrade to Pro for a team tool, or open the app at least weekly.
- **Brief analyzer:** the "Analyze a client brief" feature from the claude.ai version is hidden here. It needs an AI provider and can be added later through a Supabase Edge Function.
- **Backups:** Supabase Pro takes daily backups. **Settings → Backup → Download backup** also gives you a full JSON copy at any time.
