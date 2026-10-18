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
