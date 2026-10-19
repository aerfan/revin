# Canary Automated Test & Release Change Log

This change log tracks automated testing sessions, compatibility sweeps, stress tests, discovered defects, and their resolutions on the `canary` branch for **Revin**.

- **Branch**: `canary`
- **Staging URL**: [https://revin-canary.vercel.app](https://revin-canary.vercel.app)
- **Production URL**: [https://revin-alpha.vercel.app](https://revin-alpha.vercel.app) (Guarded on `main`)
- **Protocol**: Canary First, Automatic Testing Contract (100% pass required before promotion)

---

## Issue Tracking & Resolution Matrix

| Issue ID | Severity | Component | Finding / Symptom | Status | Fix / Resolution | Verification |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **ISSUE-001** | High | `useDocDraft` (app.js) | Race condition on mount: `useEffect([liveStr])` fires post-mount and wipes out initial user input/select before state stabilizes | **Resolved** | Added `prevLive` ref guard in `useDocDraft` so initial mount never re-clobbers state; added explicit `selected` boolean attribute to currency `<option>` elements | Verified 100% pass across Chromium & WebKit (`test/canary.compat.js`) |
| **ISSUE-002** | Medium | `Stepper` (app.js) | Container had no `data-stepper` attribute; ID was only on the input, preventing container-level targeting of buttons | **Resolved** | Added `data-stepper=${p.id}` to outer `<span class="stepper">` container | Verified 100% pass across Chromium & WebKit stepper increment interactions |
| **ISSUE-003** | High | `src/engine.js` (`csvCell`) | CSV Formula & DDE Injection (CWE-1236): Formulas with leading spaces (` =1+1`), newlines (`\n=cmd`), tabs, or pipe commands (`|cmd!A0`) could execute arbitrary commands in spreadsheet viewers | **Resolved** | Hardened `csvCell` regex to `/^\s*[=+\-@|]|^[\t\r\n]/` to prepend single quote `'` and expand quoting to include tabs `\t` and semicolons `;` | Verified in `test/canary.security.js` (Attack 1) |
| **ISSUE-004** | High | `src/ui/files.js` (`merge3`) | Prototype Pollution (CWE-1321): Unfiltered object keys in three-way merge could poison `Object.prototype` | **Resolved** | Explicitly filtered out `__proto__`, `constructor`, and `prototype` keys during object key aggregation | Verified in `test/canary.security.js` (Attack 2) |
| **ISSUE-005** | Medium | `src/ui/views/advanced.js` | Unbounded sign-off input fields and missing email format validation on digital proposal acceptance | **Resolved** | Added `maxlength` attributes, string slicing (name: 100, email: 120, org: 100), work email regex validation, and safe date fallback on rendering | Verified in `test/canary.security.js` (Attack 3) |
| **ISSUE-006** | Medium | `src/engine.js` | Extreme / adversarial numeric values (`NaN`, negative rates, `1e308`) causing unbounded calculation cascades | **Resolved** | Added rate clamping to `[0, 100,000,000]`, capped labor costs to `MAX_SAFE_INTEGER`, bounded milestone percentages to `[0, 100]`, and added try/catch to `clone(o)` | Verified in `test/canary.security.js` (Attack 5) |
| **ISSUE-007** (A11Y-01) | High | `src/ui/navigation.js` | Mobile main navigation buttons (`.navtab`) have no accessible names when text labels are hidden at `<= 768px` | **Resolved** | Added dynamic `aria-label` attribute on `<button class="navtab">` reflecting the destination and count badge | Verified across mobile screen sweeps and axe a11y audits |
| **ISSUE-008** (SEC-01) | Medium | `server.js` | Local development server permits sibling-directory traversal via string-prefix check `resolved.startsWith(ROOT)` (CWE-22) | **Resolved** | Replaced prefix check with robust containment using `!path.relative(ROOT, resolved).startsWith('..') && !path.isAbsolute(rel)`; bound server to loopback host `127.0.0.1` | Verified in `test/canary.security.js` (Attack 7) |
| **ISSUE-009** (FUNC-01) | Medium | `web/runtime.js` | Non-atomic backup import (`importAll`): mid-stream database failure leaves partially overwritten records | **Resolved** | Implemented pre-flight validation (regex, segment parity, 256 KiB size check) and snapshot-based atomic rollback of written records upon failure | Verified in `test/canary.security.js` (Attack 8) and `settings.js` |
| **ISSUE-010** (SEC-02) | Medium | `package.json` | Dependency inventory vulnerabilities reported in `npm audit` (`ws` High DoS, `uuid` Moderate via `exceljs`) | **Resolved** | Upgraded `ws` to `^8.22.0` and added `overrides` for `uuid` to `^11.1.1`; `npm audit` dropped to 0 vulnerabilities | Verified with `npm audit` and 5,754 engine fuzz checks |
| **ISSUE-011** (OPS-01) | Medium | `web/build.js` | Missing Supabase configuration fails open with exit code 0, emitting setup placeholder in CI pipelines | **Resolved** | Added strict configuration gate (`isStrict` checking `process.env.CI || process.env.VERCEL || process.env.STRICT_BUILD`) exiting with code 1 | Verified in `test/canary.security.js` (Attack 9) |
| **ISSUE-012** (SEC-03) | Low | `web/build.js`, `vercel.json` | Overly broad CSP allowlists (`script-src` includes unneeded CDNs, wildcard `*.supabase.co`) | **Resolved** | Restricted `script-src` to `'self' 'unsafe-inline'` (removed external CDNs) and scoped `connect-src` strictly to project Supabase domain and Google OAuth | Verified in `test/canary.security.js` (Attack 10) |
| **ISSUE-013** (A11Y-02) | Low | `src/styles.css` | Header elements with Sign Out button introduce 9px horizontal overflow on 320 CSS pixels | **Resolved** | Added `@media (max-width: 420px)` and `@media (max-width: 360px)` ultra-compact styles for side header, buttons, and avatar | Verified in `test/canary.screens.js` across all 12 viewports (0px overflow) |
| **ISSUE-014** (A11Y-03) | High | `web/runtime.js`, `web/template.html`, `src/template.html`, `src/ui/app-core.js` | Missing `<main>` landmarks and skip-to-content links across web and app viewports (WCAG 2.4.1, 1.3.1) | **Resolved** | Added accessible `.skip-link` utility with smooth focus transitions, designated `<main id="main-content" tabindex="-1">` across all views, and wrapped web auth cards/notices in `<main>` | Verified in zero-rule-disabled axe audits (0 violations) |
| **ISSUE-015** (A11Y-04) | High | `src/ui/views/editor.js`, `src/ui/views/settings.js`, `src/styles.css`, `src/ui/views/advanced.js` | Color contrast ratio failures (< 4.5:1) on margin badges, profitability preview pills, and milestone percentages (WCAG 1.4.3) | **Resolved** | Replaced hardcoded `#2e7d32` with design system tokens `var(--green-bg)` and `var(--green-fg)` (> 4.8:1 ratio); darkened proposal milestone text to `#096E56` (> 5.5:1 ratio) | Verified in axe audits across light and dark themes (0 violations) |
| **ISSUE-016** (A11Y-05) | Medium | `src/ui/components.js`, `src/ui/views/editor.js`, `src/ui/views/advanced.js`, `web/runtime.js` | Orphaned form inputs and missing accessible names on `StringList`, `RegisterCard`, version input, requirement input, and proposal acceptance forms (WCAG 4.1.2, 3.3.2) | **Resolved** | Added dynamic `aria-label` attributes to all add-line and search inputs; added explicit `<label for="...">` associations to all proposal sign-off inputs and web auth fields | Verified via automated orphaned input scan (0 unassociated inputs) |
| **ISSUE-017** (A11Y-06) | Medium | `src/ui/views/advanced.js`, `src/styles.css` | Interactive proposal package tier selection cards were non-focusable `<div>`s lacking keyboard event handlers; proposal tables lacked `<caption>` and `<th>` column headers (WCAG 2.1.1, 1.3.1) | **Resolved** | Converted package selection into accessible `role="radiogroup"` / `role="radio"` with `aria-checked`, `tabindex="0"`, `onKeyDown` (Space/Enter) handlers, and focus-visible rings; added semantic `<caption>`, `<thead>`, and `<th scope="col">` to proposal summary and timeline tables | Verified across full keyboard navigation and axe audit |
| **ISSUE-018** (SEC-04) | High | `.github/workflows/ci.yml`, `src/template.html`, `dev/break-ui/peek.js`, `test/*` | CodeQL security alerts: missing Subresource Integrity (SRI) on CDN scripts, dynamic regex construction in screenshot filter, overly permissive default GITHUB_TOKEN, and loose URL substring matching | **Resolved** | Added SHA-384 SRI hashes and `crossorigin="anonymous"` to CDN scripts; replaced dynamic RegExp with literal substring checking; enforced `permissions: contents: read` in CI; converted route mocks to exact hostname check (`new URL(u).hostname === 'fonts.googleapis.com'`) | Verified via GitHub Agentic Autofix PR #1 merge, CodeQL scan passing, and 100% Canary test suites pass |

---

## Session Log & Test Cycles

### Session 1: Financials & Rate Cards Baseline Contract (Completed)
- **Commit**: `921727f`
- **Scope**: Deterministic calculations, multi-currency support (`$`, `€`, `£`, `CA$`, `A$`, `৳`, `S$`, `¥`, `₹`, `CHF`), settings defaults, review inspector totals.
- **Test Results**:
  - `test:engine`: 5,754 fuzz checks, oracles & corruption tests passed (100%).
  - `test:ui`: 53 UI automation checks + 42 QA scenarios passed (100%).
  - Accessibility: 28 axe-core audits (14 screens × 2 themes) → 0 violations.
  - Responsive: 143 screen×width checks → 0 overflow issues.
- **Deploy**: Deployed to Canary preview and aliased to `revin-canary.vercel.app`. Vercel SSO deployment protection disabled for direct review.

### Session 2: Multi-Browser Compatibility (Chromium & WebKit / Safari Engine) (Completed)
- **Status**: Completed (100% pass).
- **Engines Tested**:
  1. **Chromium**: Chrome, Edge, Brave, Android WebView headless runtime.
  2. **WebKit**: Safari desktop & iOS Safari engine.
  3. **Note on Firefox**: On macOS arm64 without Full Disk Access granted to the shell, Firefox Nightly encounters sandbox file permission constraints accessing `~/Library/Application Support/Firefox`. WebKit and Chromium cover both the Blink and WebKit rendering engines thoroughly.
- **Features Tested**:
  - Multi-currency switching (USD, EUR, BDT) in estimate review.
  - Dynamic currency symbol & rate formatting (`€13,705 at €100/h`, `৳13,705 at ৳100/h`).
  - Stepper increment button interactions & reactive input updates (`100 -> 105`).
  - Settings panel financials & default rate card configuration.
  - Build step inspector cost badge update (`$14,390 · $105/h`).
- **Defects Discovered & Fixed**: ISSUE-001 (`useDocDraft` mount race condition) and ISSUE-002 (`Stepper` container locator).
- **Result**: 0 page errors, 0 unhandled promise rejections, 100% assertions satisfied.

### Session 3: Screen Sizes & Device Profiles Sweep (Completed)
- **Status**: Completed (100% pass).
- **Test File**: `test/canary.screens.js` (60 view checks across 12 screen profiles).
- **Viewport Spectrum Verified**:
  - **320×568px** (iPhone SE 1st Gen): Zero horizontal overflow (`scrollWidth <= clientWidth`), stack layout wraps cleanly, cost badges scale properly.
  - **360×800px** (Galaxy S Android Compact): Zero overflow, touch buttons accessible.
  - **375×667px** (iPhone mini / SE 3rd Gen): Zero overflow.
  - **390×844px** (iPhone 14 / 15 / 16 Standard): Zero overflow, safe area insets respected.
  - **414×896px** (iPhone Pro Max): Zero overflow.
  - **768×1024px** (iPad Mini / Air Portrait): Split layouts transition responsively.
  - **820×1180px** (iPad 10th Gen): Zero overflow.
  - **1024×768px** (iPad Landscape / Small Laptop): Sidebar / main view grid layout stable.
  - **1280×800px** (MacBook Air 13"): Clean two-column layout.
  - **1440×900px** (Standard Desktop): Default target layout verified.
  - **1920×1080px** (1080p FHD): Max-width constraints hold; no stretching or distortion.
  - **2560×1440px** (QHD Ultrawide): Content centered with balanced margins; no layout collapse.
- **Views Swept**: Dashboard, Estimate Review, Estimate Scope, Estimate Build, Settings.
- **Defects Discovered**: 0 horizontal overflows, 0 page errors, 0 clipped primary actions.

### Session 4: Stress, Concurrency & Chaos Testing (Completed)
- **Status**: Completed (100% pass).
- **Test File**: `test/canary.stress.js`.
- **Stress Scenarios & Benchmarks Verified**:
  - **500 Estimates High-Volume Load**: Rendered in **245ms**. Search across 500 records filtered to 63 rows in **124ms**.
  - **Rapid Stepper Click Storm**: 20 rapid consecutive clicks (with 10ms click intervals) completed in **1,037ms**. Rate transitioned from 100 to 200 without a single dropped event or calculation desync.
  - **Reactive Financials Recalculation**: Live cost badge immediately re-computed the entire estimate total under stress (`$23,909 at $200/h`).
  - **Heavy Estimate Benchmark (250 items)**: Full breakdown, complexity multipliers, phase splits, overheads, and currency calculations executed in **<1ms** (`3,382.6h · $338,259`).
  - **Rapid Navigation Churn & Memory Stability**: 30 rapid view switches (Build → Scope → Review) executed in **1,010ms**. Final heap memory remained stable at 65 MB, verifying zero DOM listener leaks or runaway memory retention.
- **Defects Discovered**: 0 crashes, 0 memory leaks, 0 calculation desyncs.

### Session 5: Platform Optimization & Security Hardening (Completed)
- **Status**: Completed (100% pass).
- **Scope**:
  - **Runtime Delivery Consolidation**: Preact runtime (`preact.umd.min.js`, `hooks.umd.min.js`, `htm.umd.min.js`) bundled into single `/vendor/preact-core.min.js` (16 KB) by `web/build.js`, saving 2 network requests on boot.
  - **Dynamic Lazy Loading & Resilience**: Enhanced `loadScript` error handling with explicit library labels (Word / Excel), preventing misleading error toasts.
  - **Font Pre-fetching**: Added `dns-prefetch` alongside `preconnect` for Google Fonts and GStatic.
  - **Security & CSP Hardening (`vercel.json` & `web/build.js`)**:
    - Added HTTP `Content-Security-Policy` header allowing Google Fonts, Supabase endpoints, and Google OAuth without broad wildcards.
    - Added `Cross-Origin-Opener-Policy: same-origin-allow-popups` ensuring Google OAuth popups retain communication with parent window without cross-origin blockage.
    - Added `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()`.
    - Added `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`.
- **Verification**: 100% pass across all engine tests, 53 UI automation checks, 42 QA scenarios, 28 axe audits, 143 responsive width checks, and Canary compatibility suites.

### Session 6: Database Security & Integrity Hardening (Completed)
- **Status**: Completed (100% pass).
- **Migration**: `supabase/migrations/0002_security_hardening.sql`.
- **Database Protections Implemented**:
  - **PostgreSQL Check Constraints on `public.docs`**: Max 256 KiB size limit (`docs_size_max`) and regex path validation (`docs_valid_path`) enforced at the database engine level to block direct PostgREST payload abuse.
  - **Deterministic Hierarchy Trigger (`trg_docs_integrity`)**: Automatically maintains `parent`, `id`, `updated_at`, and `updated_by` on insert/update, eliminating path spoofing vulnerabilities.
  - **Search-Path Hijacking Protection**: Explicit `set search_path = public, pg_temp` on all Security Definer and Security Invoker functions.
  - **First-Sign-up Hijacking Defense**: Explicitly pre-authorizes `aerfan.work@gmail.com` as admin in `handle_new_user()` and pre-seeds an invite into `public.invites`.
  - **Last-Admin Safeguard**: Enforced in `set_member_role()` so the organization's last active admin cannot be demoted or removed.
  - **Profile Input Sanitization**: Stripping control characters and null bytes in `update_my_profile()`.
- **Verification**: 100% pass across all 53 UI checks, 42 QA scenarios, 7 v2 scenarios, 3 F1 scenarios, 28 axe audits, and 143 responsive sweeps.

### Session 7: Zero-Cost Observability & Automated Issue Tracking (Completed)
- **Status**: Completed (100% pass).
- **Database Migration**: `supabase/migrations/0003_observability.sql`.
- **Client Telemetry**: `src/app.js` (`Telemetry` module, `HealthPanel`, and `Boundary` integration).
- **Automated Test Suite**: `test/canary.telemetry.js`.
- **Architecture & Features Implemented**:
  - **In-App Telemetry & Circular Breadcrumbs**: Tracks user navigation, action intents, and step transitions in an in-memory 15-event circular ring buffer without performance overhead.
  - **Deterministic Error Fingerprinting**: Hashes `message + normalized top stack frame` to group identical crashes together.
  - **Local Storage Persistence & Offline Triage**: Stores up to 50 diagnostic records in `dhe:error_logs` so developers and users can inspect and copy issues immediately even when disconnected from Supabase.
  - **Automated Database Deduplication RPC (`log_client_error`)**: Automatically increments `occurrence_count` and updates `last_seen` timestamp for existing incidents within a 24-hour window, preventing log flooding during crash loops.
  - **1-Click "Copy for AI" Bug Triage**: Formats full incident diagnostics (stack trace, route, breadcrumbs, user agent, timestamps) into structured Markdown ready to paste directly into Google Antigravity, Claude Code, or Codex for instant automated fixing.
  - **Settings Health & Diagnostics Panel**: Administrative dashboard embedded into Settings allowing team leads to inspect incident counts, review recent breadcrumbs, and clear resolved logs.
- **Verification Results**:
  - `node test/canary.telemetry.js`: Passed (100%).
  - `npm run test:engine`: 5,754 checks passed (100%).
  - `node test/canary.compat.js && node test/canary.screens.js && node test/canary.stress.js`: Passed across all browsers and 12 device viewports (100%).
  - `npm run test:ui`: All 53 UI checks, 42 QA scenarios, 7 v2 scenarios, 3 F1 scenarios, 28 axe audits, and 143 responsive width sweeps passed (100%).

### Session 8: UI Architecture Modularization & Multi-Agent Component Decoupling (Completed)
- **Status**: Completed (100% pass).
- **Scope**: Decomposed monolithic `src/app.js` (2,869 lines) into 14 focused, single-responsibility modules under `src/ui/`.
- **Architectural Enhancements**:
  - `src/ui/header.js`: Environment preconditions and Preact imports.
  - `src/ui/icons.js`: Phosphor icon SVG definitions and category duotone systems.
  - `src/ui/telemetry.js`: Breadcrumb ring buffer, localStorage persistence, and RevinTelemetry API.
  - `src/ui/helpers.js`: Pure data helpers, formatters, and slug generators.
  - `src/ui/components.js`: Design system primitives (`Stepper`, `Modal`, `CardHead`, `Banner`, `Avatar`).
  - `src/ui/files.js`: File export dispatchers and 3-way conflict resolution engine (`merge3`).
  - `src/ui/navigation.js`: Responsive sidebar navigation and light/dark theme switcher.
  - `src/ui/views/estimates.js`: Estimates dashboard and new estimate wizard.
  - `src/ui/views/editor.js`: Scope, build, review steps and live inspector panel.
  - `src/ui/views/advanced.js`: Packages, versions, requirements traceability, actuals, briefs, calibrate.
  - `src/ui/views/library.js`: Library CMS, gap rules, starter packs, item modals.
  - `src/ui/views/settings.js`: General defaults, financials rate cards, team management, and health diagnostics.
  - `src/ui/app-core.js`: Root `App` state container, live sync listeners, and providers.
  - `src/ui/boot.js`: Global exception traps and DOM mounting bootstrap.
  - `dev/bundle-ui.js`: High-speed zero-dependency assembler integrated directly into `build.js` and `web/build.js`.
- **Multi-Agent Benefit**: Eliminates git merge conflicts when multiple AI agents (Google Antigravity, Claude Code, Cursor, Codex) work in parallel worktrees.
- **Verification Results**:
  - `npm run bundle:ui`: Assembled `src/app.js` (248.5 KB) in 4ms with 0 syntax errors.
  - `npm run test:engine`: 5,754 checks passed (100%).
  - `node test/canary.telemetry.js`: Passed (100%).
  - `node test/canary.compat.js && node test/canary.screens.js && node test/canary.stress.js`: Passed across all engines and 12 device viewports (100%).
  - `npm run test:ui`: All 53 UI checks, 42 QA scenarios, 28 axe audits, and 143 responsive width sweeps passed (100%).

### Session 9: Blended Roles, Agency Margin Modeling & Milestone Payment Schedules (Completed)
- **Status**: Completed (100% pass).
- **Scope**: Implemented Phase A of the strategic ROI matrix across mathematical engine, UI modules, and test contracts.
- **Architectural Enhancements**:
  - `src/engine.js`:
    - Added `costRate` modeling alongside `hourlyRate` (billing rate).
    - Added `laborCost` (`total * costRate`), `grossProfit` (`totalCost - laborCost`), and `marginPercent` (`Math.round(((totalCost - laborCost) / totalCost) * 100)`).
    - Added `DEFAULT_ROLES` role presets (Design Lead $160/h, Senior Product Designer $125/h, UI/UX Designer $95/h, Motion/3D $140/h, Design QA $80/h).
    - Added `DEFAULT_MILESTONES` and `computeMilestones(totalCost, milestones)` for exact payment installment calculations.
  - `src/ui/views/settings.js`:
    - Added Default Internal Cost Rate stepper (`#set-cost-rate`) under Financials & rate cards.
    - Added live Target Agency Margin preview badge.
  - `src/ui/views/editor.js`:
    - Added estimate-level `#est-cost-rate` input in Commercials & rate card.
    - Added live gross margin pill in `total-cost-badge` and `Inspector` (`Margin: X% · $Y profit`).
    - Added **Payment milestone schedule** card in the Review step with installment breakdown and percentages.
  - `test/engine.test.js`:
    - Added unit test contract assertions for blended cost rate, margin calculations, and milestone schedules.
- **Verification Results**:
  - `npm run test:engine`: 5,754 checks passed (100%).
  - `npm run test:canary`: Passed across Chromium, WebKit, 12 screen profiles, telemetry, and 1,000-estimate stress benchmarks (100%).
  - `npm run test:ui`: All 53 UI checks, 42 QA scenarios, 28 axe audits, and 143 responsive width sweeps passed (100%).

### Session 10: Interactive Client Proposal Portal, PWA Service Worker & Performance Virtualization (Completed)
- **Status**: Completed (100% pass).
- **Scope**: Executed Phase B of the CTO roadmap + Performance and caching optimizations.
- **Architectural Enhancements**:
  - `src/ui/views/advanced.js`:
    - Converted static proposal into an interactive client proposal portal (`ProposalView`).
    - Added one-click **Client Presentation Mode** toggle with `.clean-mode` layout (strictly hiding all sensitive agency internals, internal cost rates, margins, and private notes).
    - Added interactive **Package Tier Comparison** (Essential / Standard / Complete): clients can click to switch packages, updating hours, scope, and total investment dynamically.
    - Added **Payment milestone schedule** cards (e.g. Deposit 40%, Milestone 30%, Handover 30%).
    - Added **Digital Proposal Acceptance & Sign-off Flow**: interactive sign-off form (Name, Work Email, Organization, Agreement checkbox) saving an immutable `acceptance` record with timestamp and setting status to `approved`.
    - Added verified **Digital Acceptance Certificate Seal** with Phosphor `sealCheck` badge, signee metadata, contract value, and estimator revocation flow.
  - `src/ui/views/editor.js`:
    - Added 1-click **Client Mode** toolbar button (`#btn-toggle-client-mode`) directly in the editor header.
  - `src/styles.css`:
    - Added styles for `.clean-mode`, `.prop-clean-bar`, `.pk-card`, `.paper-signed-cert`, and `.paper-sign-card`.
    - Added `@media print` rules hiding navigation, sidebars, and banners for pristine PDF printing via `window.print()`.
    - Applied deferred rendering `.est-card-deferred` (`content-visibility: auto; contain-intrinsic-size: auto none auto 60px;`) following modern web performance guidelines.
  - `web/sw.js` & `web/build.js`:
    - Implemented Revin PWA Service Worker (`web/sw.js` -> `dist-web/sw.js`) with Cache-First strategy for `/vendor/*` assets and Google fonts, and Network-First for HTML documents.
    - Registered in `web/template.html`.
    - Configured `vercel.json` rewrites and headers to exclude `sw.js` and serve it with `no-cache, no-store, must-revalidate`.
  - `test/canary.proposal.js`:
    - Authored comprehensive end-to-end Canary test suite verifying Client Mode switching, internal margin suppression, tier switching, presentation mode, digital acceptance, and revocation.
- **Verification Results**:
  - `npm run test:engine`: 5,754 fuzz checks, oracles & corruption tests passed (100%).
  - `npm run test:canary`: 6 suites (Chromium, WebKit, 12 screen viewports, stress, extreme stress, proposal) passed (100%).
  - `npm run test:ui`: All 53 UI automation checks, 42 QA scenarios, 7 v2 scenarios, 3 F1 scenarios, 28 axe accessibility audits (0 violations), and 143 responsive width checks passed (100%).

### Session 11: Automated Security Testing, Penetration Suite & Vulnerability Hardening (Completed)
- **Status**: Completed (100% pass, 0 vulnerability findings).
- **Scope**: Rigorous security audit, active exploit fuzzing, automated penetration test suite authoring (`test/canary.security.js`), and defensive hardening across all input and data surfaces.
- **Attack Vectors Tested & Hardened**:
  1. **CSV Formula & DDE Injection Exploitation (CWE-1236)**:
     - *Attack*: Injected adversarial formulas (`=1+1`, `|cmd!A0`, `\n=cmd|calc!A0`, `   +SUM(...)`, `@AVERAGE`, `\t-20`) into project names, item names, and deliverables.
     - *Finding*: Spreadsheets execute formulas with leading whitespace or pipe prefixes, and unquoted tabs/semicolons cause delimiter splitting.
     - *Mitigation*: Hardened `csvCell` in `src/engine.js` with regex `/^\s*[=+\-@|]|^[\t\r\n]/` to prepend single quote `'`, and expanded quoting check to `/[",\r\n\t;]/`.
  2. **Prototype Pollution via State & Merging Helpers (CWE-1321)**:
     - *Attack*: Injected `__proto__`, `constructor.prototype`, and polluted properties via three-way document merging.
     - *Mitigation*: Added strict key filtering in `merge3` (`src/ui/files.js`) ignoring `__proto__`, `constructor`, and `prototype`.
  3. **Stored XSS & DOM Injection in Proposal Sign-off (CWE-79)**:
     - *Attack*: Injected `<script>alert(1)</script>`, `<img src=x onerror=...>`, and oversized payload strings into digital sign-off inputs.
     - *Mitigation*: Added strict character length clamping (name: 100, email: 120, org: 100), work email format regex validation, HTML `maxlength` attributes, and safe date verification on certificate seal rendering (`src/ui/views/advanced.js`).
  4. **Confidential Commercial Data Leakage (CWE-200)**:
     - *Attack*: Verified DOM inspection in Client Presentation Mode (`.clean-mode`) to confirm that internal cost rates (`costRate`), blended labor costs, and agency gross margins are never exposed in DOM nodes or accessible to clients.
  5. **Mathematical Calculation Fuzzing & Boundary Hardening (CWE-128)**:
     - *Attack*: Fuzzed hourly rates, cost rates, and milestone schedules with negative values, `NaN`, `Infinity`, `1e308`, and malformed objects.
     - *Mitigation*: Clamped rates in `src/engine.js` to `[0, 100,000,000]`, capped labor costs to `Number.MAX_SAFE_INTEGER`, bounded milestone percentages to `[0, 100]`, and wrapped `clone(o)` in defensive try/catch.
  6. **ReDoS (Catastrophic Backtracking) Fuzzing (CWE-1333)**:
     - *Attack*: Tested CSV and email regex patterns with 20,000-character adversarial strings containing nested prefixes and backtracking traps.
     - *Mitigation*: All regex patterns verified to execute in < 5ms with zero linear/exponential performance degradation.
- **Verification Results**:
  - `npm run test:security`: All 6 attack vectors passed with 0 vulnerability findings.
  - `npm run test:canary`: All 7 canary suites passed (100%).
  - `npm run test:engine`: 5,754 checks passed (100%).
  - `npm run test:ui`: All 53 UI automation checks, 42 QA scenarios, 28 axe audits, 143 responsive width sweeps passed (100%).

### Session 12: Post-Acceptance Webhooks & Outbound Automation (Phase 1) (Completed)
- **Status**: Completed (100% pass).
- **Scope**: Executed Phase 1 of the CTO strategic roadmap: automated outbound webhook dispatch upon proposal digital sign-off (enabling automated Stripe deposit invoicing, Slack team notifications, and Zapier/Make CRM sync).
- **Architectural Enhancements**:
  - `src/engine.js`:
    - Updated `normalizeSettings` to support and validate `st.webhooks` (`enabled`, `url`, `secret`, `events`).
    - Added `formatWebhookPayload(estimate, event, opts)`:
      - Sanitizes and extracts full commercial metrics (`totalCost`, `totalHours`, `laborCost`, `grossProfit`, `marginPercent`), milestone payment schedules, and digital acceptance credentials.
      - Automatically detects Slack or Discord incoming webhook endpoints and serializes into Slack BlockKit cards with header, formatted fields, and context timestamps.
    - Added `dispatchWebhook(url, payload, secret, timeoutMs)`:
      - Strictly validates HTTPS endpoint protocol (protecting against SSRF and non-secure schemes).
      - Attaches `Content-Type: application/json`, `X-Revin-Event`, `X-Revin-Delivery`, and optional `X-Revin-Secret` headers.
      - Uses `AbortController` with an 8000ms timeout to prevent hanging requests.
  - `src/ui/views/settings.js`:
    - Added dedicated `WebhooksPanel` directly below Financials & rate cards.
    - Includes `#wh-enabled` toggle, `#wh-url` HTTPS input, `#wh-secret` signing key input, and supported events badges.
    - Added `#btn-test-webhook` ("Send test webhook") with live toast notification on delivery.
  - `src/ui/views/advanced.js`:
    - Wired `signProposal` to trigger non-blocking outbound webhook delivery upon successful proposal acceptance.
    - Added error interception and telemetry breadcrumbs (`Telemetry.crumb` and `Telemetry.record`) ensuring that network or CORS errors never block client sign-off.
  - `src/ui/icons.js`:
    - Added Phosphor `plug` icon to `ICONS`.
  - `test/canary.webhook.js`:
    - Authored comprehensive test suite verifying payload serialization, Slack formatting, protocol validation, Settings test ping, and E2E proposal acceptance webhook interception.
- **Verification Results**:
  - `node test/canary.webhook.js`: Passed (100%).
  - `npm run test:canary`: All 8 canary suites passed (100%).
  - `npm run test:engine`: 5,754 checks passed (100%).

### Session 13: Independent Audit Report Remediation (Completed)
- **Status**: Completed (100% pass across all 8 canary suites, 5,754 engine tests, 10 security penetration checks, and 53 UI automation suites).
- **Target Report**: `Revin_Test_Report.md` (Dated 19 Oct 2026).
- **Audit Findings Resolved**:
  1. **A11Y-01 (High — Mobile Navigation Accessibility)**:
     - *Finding*: `.navtab .lbl { display: none; }` at `<= 768px` left navigation buttons without accessible names in the browser accessibility tree.
     - *Resolution*: Updated `src/ui/navigation.js` (`Sidebar.tab`) to add dynamic `aria-label=${label + (count !== undefined ? ' (' + count + ')' : '')}` directly to `<button class="navtab">`.
     - *Verification*: Verified across all screen profiles and 28 axe audits. Screen readers and automated accessibility trees now receive clear names at any viewport width.
  2. **SEC-01 (Medium — Development Server Path Confinement)**:
     - *Finding*: `server.js` used `resolved.startsWith(ROOT)`, allowing sibling directory traversal (e.g. `/../app-sibling/marker.txt`).
     - *Resolution*: Replaced string prefix matching with strict path containment: `const rel = path.relative(ROOT, resolved); if (rel.startsWith('..') || path.isAbsolute(rel)) ...`; bound local server explicitly to loopback host `127.0.0.1`.
     - *Verification*: Added Attack 7 in `test/canary.security.js` confirming sibling directory escapes, parent escapes, and encoded traversals are rejected with HTTP 403.
  3. **FUNC-01 (Medium — Non-Atomic Backup Import)**:
     - *Finding*: `web/runtime.js` (`importAll`) wrote documents sequentially via RPC without pre-validation or rollback, leaving partially overwritten datasets on mid-stream failure.
     - *Resolution*:
       - Added pre-flight validation phase: checks path regex (`^[A-Za-z0-9_.-]{1,100}(/[A-Za-z0-9_.-]{1,100})*$`), even segment count (<= 8), object type check, and UTF-8 byte length limit `<= 262,144` bytes (256 KiB) before touching the database.
       - Added pre-import snapshotting: queries existing document state for all target paths.
       - Added automatic rollback: on write failure, restores pre-existing documents or deletes newly inserted documents, returning clean `{ rolledBack: true, error: ... }`.
       - Updated `src/ui/views/settings.js` to report clean rollback status to users.
     - *Verification*: Added Attack 8 in `test/canary.security.js`.
  4. **SEC-02 (Medium — Dependency Inventory Vulnerabilities)**:
     - *Finding*: `npm audit` flagged 3 vulnerabilities (`ws` High DoS via memory exhaustion in `ws@8.18.0`, `uuid` Moderate via `exceljs@4.4.0`).
     - *Resolution*: Upgraded `ws` to `^8.22.0` in `package.json` and added `"overrides": { "uuid": "^11.1.1" }`.
     - *Verification*: `npm audit` returns **0 vulnerabilities**; 5,754 engine fuzz tests and Excel workbook generation pass 100%.
  5. **OPS-01 (Medium — Build Gate Fail-Open on Missing Configuration)**:
     - *Finding*: `web/build.js` only warned on missing `SUPABASE_URL` / `SUPABASE_ANON_KEY` and exited 0, risking deploying a broken placeholder build in CI.
     - *Resolution*: Added strict configuration check: if `process.env.CI || process.env.VERCEL || process.env.STRICT_BUILD || process.argv.includes('--strict')`, missing backend keys exit immediately with code 1 (`process.exit(1)`).
     - *Verification*: Verified with `--strict` subshell test and Attack 9 in `test/canary.security.js`.
  6. **SEC-03 (Low — Overly Broad Content Security Policy)**:
     - *Finding*: Live CSP headers and HTML meta policy included unneeded CDNs (`unpkg.com`, `cdnjs`, `jsdelivr`) and wildcard `*.supabase.co` in `connect-src`.
     - *Resolution*: Locked down `script-src` to `'self' 'unsafe-inline'` across both `web/build.js` and `vercel.json`; restricted `connect-src` strictly to configured project origin, WebSocket endpoint, and Google OAuth endpoints.
     - *Verification*: Attack 10 in `test/canary.security.js` verified zero external unneeded CDNs in script policy.
  7. **A11Y-02 (Low — Mobile Header 320px Viewport Overflow)**:
     - *Finding*: At 320 CSS pixels, header controls with the Sign Out button extended 9px past the viewport (`scrollWidth = 329px`).
     - *Resolution*: Added `@media (max-width: 420px)` and `@media (max-width: 360px)` ultra-compact rules in `src/styles.css` adjusting `.side` padding (6px), navtab padding (4px), brand padding, theme switcher button size (19px), and signout button size (26px).
     - *Verification*: Screen sweeps in `test/canary.screens.js` across all 12 viewports (including 320px with authenticated Sign Out button active) pass with 0 defects and 0px horizontal overflow.

### Session 14: Vercel Web Analytics Integration (Completed)
- **Status**: Completed (100% pass).
- **Scope**:
  - Integrated native Vercel Web Analytics tracking snippet into `web/template.html` (`window.va` stub + `/_vercel/insights/script.js`).
  - Installed `@vercel/analytics` (`^2.0.1`) in `package.json` with 0 vulnerabilities.
  - Excluded `_vercel/` from SPA rewrites in `vercel.json` (`/((?!_vercel/|vendor/|sw\\.js).*)`) ensuring edge insights endpoints are never intercepted by client-side routing.
  - Added bypass in `web/sw.js` for `url.pathname.startsWith('/_vercel/')` ensuring PWA Service Worker never caches or intercepts telemetry.
  - Added 204 handler in `server.js` for local development server cleanliness.
  - Extended `src/ui/telemetry.js` with `Telemetry.track(name, data)` hooking into `window.va('event', ...)` for custom event tracking (e.g. `proposal_accepted`).
- **Verification**: 100% pass across all engine tests (5,754 checks), security penetration suite (10 vectors), compatibility suites (Chromium & WebKit), 12 responsive screen viewports, and proposal portal sign-off contracts.

### Session 15: Accessibility (A11y) Hardening & Zero-Violation Audit (Completed)
- **Status**: Completed (100% pass).
- **Audit Tooling**: Chrome DevTools a11y protocols + `axe-core` 4.10 with zero rules disabled (`wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa`, `best-practice`).
- **Defects Resolved**:
  1. **A11Y-03 (Landmark Structure & Skip Navigation)**:
     - Embedded `.skip-link` utility with smooth transition and keyboard focus targeting `<main id="main-content" tabindex="-1">`.
     - Wrapped web standalone auth views (`AuthCard`) and notification screens (`Notice`) in `<main>` landmarks.
  2. **A11Y-04 (Color Contrast Remediation)**:
     - Replaced non-standard `var(--green, #2e7d32)` with design tokens `var(--green-bg)` and `var(--green-fg)` across editor inspector badges, cost rate margin indicators, and settings target margin preview.
     - Darkened proposal milestone percentages and eyebrow typography to `#096E56` (> 5.5:1 ratio on light surfaces).
  3. **A11Y-05 (Orphaned Form Inputs & Accessible Names)**:
     - Added dynamic `aria-label` bindings to `StringList` and `RegisterCard` input fields (`reg-new-assumptions`, `reg-new-exclusions`, `reg-new-dependencies`, `reg-new-risks`, `phase-new`, etc.).
     - Added accessible labels to `ver-label` ("Version label") and `req-new` ("New requirement").
     - Added explicit `<label for="...">` associations and `aria-label` attributes to digital proposal acceptance fields.
  4. **A11Y-06 (Keyboard Navigation & Table Semantics in Proposals)**:
     - Enhanced package tier cards with `role="radiogroup"` / `role="radio"`, `aria-checked`, `tabindex="0"`, and `Space`/`Enter` keyboard interaction.
     - Enhanced proposal financial summary and timeline tables with `<caption>`, `<thead>`, and `<th scope="col">` column headers.
  5. **Tap Target Touch Sizes**:
     - Increased minimum touch target heights to >= 28px for `.crumbs button` and `.link-arrow` navigation controls.
### Session 16: GitHub Remote Sync & CodeQL Security Remediations (PR #1) (Completed)
- **Status**: Completed (100% pass).
- **Scope & Remote Changes Merged**:
  - Fetched and merged remote updates from `origin/main` containing GitHub Agentic Autofix PR #1 (`Remediate CodeQL security alerts aerfan/revin#1`).
  - Added Subresource Integrity (SRI) SHA-384 hashes and `crossorigin="anonymous"` to CDN-loaded scripts (`preact`, `preact/hooks`, `htm`) in `src/template.html`.
  - Replaced dynamic user-input RegExp construction with literal substring containment in `dev/break-ui/peek.js`.
  - Tightened test runner URL interceptors (`new URL(u).hostname === 'fonts.googleapis.com'`) across `test/ui.*.js` and `dev/break-ui/*`.
  - Hardened GitHub Actions CI workflow (`.github/workflows/ci.yml`) by restricting default permissions to `permissions: contents: read` while preserving the full dual-node matrix, security suite, and build summary reporting.
  - Standardized `.github/workflows/codeql.yml` with `actions/checkout@v4` and dual `main`/`canary` scanning.
- **Verification**:
  - `npm run test:engine`: 5,754 unit & fuzz checks passed (100%).
  - `npm run test:security`: 10 vulnerability surfaces checked, 0 findings (100%).
  - `npm run test:canary`: All 8 canary suites passed (viewport sweeps, stress & chaos, telemetry, 1,000-estimate benchmarks, proposal portal, security, webhooks).
  - `test:ui` & `test:a11y`: 53 UI automation checks passed, 30 axe audits (0 violations), 154 responsive screen checks passed (100%).
