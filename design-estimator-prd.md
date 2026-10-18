# PRD: Block-Based Design Estimator (working title)

| | |
|---|---|
| **Version** | 1.2 |
| **Status** | v1 live with the Mintlify-style redesign (§16) and a full QA hardening pass (§17). Working defaults in §10.2 still to be replaced with real numbers |
| **Last updated** | 2026-10-18 |
| **Owner** | TBD |

### Changelog
- **v1.2**: Standalone app (§20) on Supabase + Vercel, with Google or email sign-in, team management (invites, approval, company domain), backups and import from the claude.ai version. The brief analyzer is hidden in the standalone build for now.
- **v1.1**: Built F1 actuals tracking (§19): actual hours per item and for project time, variance per line and overall, timesheet import, an Actuals sheet in the Excel export, and Library → Calibrate hours now reads tracked estimates automatically. Fixed a stylesheet regression from v1.0 that had switched off the §16 motion and polish styles; added a CSS parse check to the test suite.
- **v1.0**: Built the v2 next steps (§18): C2 packages, E1 versions with diff, D2 requirements and traceability, A1 brief analyzer (Claude in the page), G3 client proposal (Word) and library calibration from past projects. Computed totals display to one decimal; entered values show exactly.
- **v0.9**: Worst-case data pass (14 fixes: pageable estimate list, exact decimals, thousands separators, initials avatars, right-to-left names, wrapping titles and badges). Added purposeful motion (§16): press feedback, dialog and toast enter/exit, in-place reveals, a rising unsaved-changes bar and first-run empty states; reduced motion keeps fades only.
- **v0.8**: Lead-QA pass across engine, data store and interface (§17, full report in `qa-report.md`). Fixed 24 findings, including CSV formula injection, estimates recreated after a teammate deleted them, teammates' edits lost while typing, crashes on malformed data, and WCAG AA contrast and keyboard issues. Added three-way merging of simultaneous edits, a deleted-estimate banner with Restore, automatic reconnection, a size guard and number limits. Accent token darkened to `#0C8468` for contrast (§16).
- **v0.7**: Added §16 **Visual design direction**, based on the provided UI references (category table with duotone icons, Gridline-style menu cards) and Mintlify's dashboard style: off-white ground, white rounded cards, pastel icon tiles, muted parenthetical details, mint green for primary actions, compact sidebar navigation.
- **v0.6**: v1 built and published as the **Design Hours Estimator** app. Starter library seeded. Added §15 build notes (what shipped, access, verification, known limits, next steps).
- **v0.5**: Adopted the recommended BA/requirements shortlist. **v1** adds the gap & completeness checker (A3), item definitions with included/excluded scope (B1), the assumptions/exclusions/dependencies/risks register (B2), complexity levels (B3), non-functional scope options (B4), MoSCoW priorities and phases (C1) and the status pipeline (E3). Added §10 **v1 release scope** with working defaults for every open calculation question. Decided the technical approach (§13): v1 runs as a hosted web app on claude.ai with sign-in, a shared database and role-based access.
- **v0.4**: Added candidate features for business analysis & requirements engineering, with a suggested phase for each.
- **v0.3**: Defined the end-to-end user flow, pages with expandable sections, the admin CMS, extensible services and custom items. Moved to a multi-user web app with a backend.
- **v0.2**: Rewrote around a reusable feature library with preset hours, deliverables, add-ons, overhead and buffer.
- **v0.1**: Initial generic ideation draft.

---

## 1. Problem

We are a design agency offering mostly UX/UI design: websites, mobile apps, web applications/dashboards and more. Clients ask for a quotation, but we can't quote directly. Today we:

1. Collect the brief: features, modules, journeys, pages, deliverables.
2. Document them as a list.
3. Estimate hours **per feature / journey / page** by hand.
4. Add project-level time: requirement breakdown, project setup, meetings, feedback & iterations.
5. Add a **buffer** of 10–15%.
6. Compile the total into a quotation.

**The pain:** most of this is repetitive. Every app has login, sign-up, password reset, notifications and settings. Every website has a hero, testimonials, a footer. We already know roughly what each takes, yet every estimate re-types them and re-decides the hours. That makes estimating **slow, inconsistent and error-prone**, and the resulting scope is hard to defend because assumptions and exclusions are rarely written down.

## 2. Solution

A **click-first, block-based estimation app** that doubles as a lightweight **requirements workbench**. The estimator:

1. picks a service,
2. sets the scope options (responsiveness, languages, themes, extra deliverables, quality & handoff),
3. ticks pages/features/sections from a library that already carries default hours, definitions and scope notes,
4. sets complexity, priority (MoSCoW) and phase where needed, guided by gap suggestions,
5. reviews the full hour breakdown, scope scenarios, phases, deliverables list and assumptions register,
6. exports to CSV or XLSX.

Everything the estimator picks from is managed in an **admin CMS**. The tool grows with the agency: new pages, sections, features, rules and whole new services (branding, video, etc.) can be added without code changes.

### Goals
- A typical estimate in **minutes**, done almost entirely by **clicking**, with minimal typing
- **Consistent** hours for recurring work across estimators and projects
- Every total is **traceable** to its pages, sections, features, options, overhead and buffer
- Every estimate states its **assumptions and exclusions**, so scope is defensible
- Exports open cleanly in **Google Sheets and Excel** (CSV + XLSX with live formulas)
- **Extensible** to any service the agency offers

## 3. Users & roles (decided)

Sign-in uses claude.ai accounts. Roles map to the app's sharing levels:

| Role | Sharing level | Can do |
|---|---|---|
| **Admin** | Owner or Editor | Everything an Estimator can, plus manage the CMS (services, options, library, sections, starter packs, gap rules) and global settings (overhead, buffer, complexity, phases, default assumptions) |
| **Estimator** | Contributor | Create, edit, duplicate, delete and export estimates; add custom items |
| **No access** | Viewer / Commenter | Sees a notice asking for access; reads no library or estimate data |

Note: on claude.ai plans without a Contributor level, collaborators invited as Editors get Admin rights.

## 4. User flow (estimator)

```
Sign in (claude.ai)
  └─ Estimates dashboard: list, search, status filter + "New estimate"
       └─ Step 1  Choose service        Website | Mobile app | Web app | (any service added in the CMS)
            └─ Step 2  Scope             Responsiveness · Localization · Theming · Other deliverables · Quality & handoff · Custom deliverables
                 └─ Step 3  Build        Library items (pages → sections, modules → features) · starter packs · gap suggestions · custom items
                      └─ Step 4  Review  Totals · breakdown · scope scenarios · phases · deliverables · assumptions register · status · export
```

Steps can be revisited at any time; the total updates live and changes save automatically.

### 4.1 Step 1: Choose service
Large clickable cards, one per active service in the CMS, plus estimate name and client. Inactive services stay hidden from estimators.

### 4.2 Step 2: Configure scope
Option groups shown as chips, toggles and number steppers. Groups are defined per service in the CMS. Website defaults:

| Group | Options | Input |
|---|---|---|
| **Responsiveness** | Desktop (primary, always on) · Mobile responsive · Tablet responsive | Toggles |
| **Localization** | Number of languages · RTL support | Stepper + toggle |
| **Theming** | Light only · Dark only · Light + Dark | Single choice |
| **Other deliverables** | Design system / UI kit · Interactive prototype · Custom illustrations · Custom animations · Custom icon set | Toggles + quantities |
| **Quality & handoff** (non-functional, B4) | Accessibility (WCAG 2.1 AA) · Developer handoff & specs · Design QA rounds | Toggles + stepper |
| **Custom deliverables** | Anything not listed | Name + hours |

### 4.3 Step 3: Build from the library
- Items are grouped by category (e.g. Core pages, Commerce; or modules like Authentication). Each row shows default hours and an **info popover with the item's definition and included/excluded scope** (B1).
- **Ticking** an item adds it. Items with sub-items (e.g. a page's sections) expand to show their **default sub-items**; others can be added from the service's sub-item library or as custom sub-items.
- Per selected item: **quantity** (where allowed), **complexity** (Simple / Standard / Complex, B3), **priority** (Must / Should / Could / Won't, C1), **phase** (e.g. Phase 1 MVP, C1), and hour adjustments with steppers.
- **Starter packs** add common bundles in one click.
- **Gap suggestions** (A3) appear as cards ("You added Cart. Add Checkout?") with Add / Dismiss.
- **Custom items** (feature, page, section) can be added with a name and hours. Admins can save a custom item to the library.

### 4.4 Step 4: Review
- **Totals**: base design, adaptations & add-ons, overhead, buffer, total
- **Breakdown** by item → sub-item, options, custom deliverables, overhead, buffer
- **Scope scenarios** (C1): Must only · Must + Should · Must + Should + Could
- **Hours by phase** (C1)
- **Deliverables list** generated from the scope
- **Assumptions register** (B2): assumptions, exclusions, dependencies, risks. Pre-filled from item definitions and the agency's default assumptions; editable
- **Out of scope**: items marked Won't have
- **Overhead & buffer** adjustable per estimate
- **Status** (E3): Draft → In review → Sent → Won / Lost
- **Export**: CSV, XLSX

## 5. Calculation (v1)

```
Item hours          = (item base hours + Σ selected sub-item hours) × quantity × complexity multiplier
Base design hours   = Σ item hours for items not marked Won't have        [primary breakpoint/platform]
Option hours        = per option rule:
                        none      → 0
                        percent   → Base design hours × rate % × units
                        fixed     → hours × units
                        per item  → hours × number of items × units
                      units = 1 for a toggle, (quantity − free units) for a stepper
Custom deliverables = Σ hours × quantity
Design subtotal     = Base design + Option hours + Custom deliverables
Overhead            = Σ fixed items + Σ percent items × Design subtotal
Subtotal            = Design subtotal + Overhead
Buffer              = Subtotal × buffer %
TOTAL               = Subtotal + Buffer
```

- **Scope scenarios** recompute the same formula with only the chosen priorities included.
- **Hours by phase**: each phase gets its own items' base design hours; shared hours (options, overhead, buffer) are split in proportion to each phase's share of base design hours.
- All rates, multipliers and defaults come from the CMS (see §10.2 for v1 defaults).

## 6. Admin CMS

| Manage | Details |
|---|---|
| **Services** | Name, description, icon, order, active/inactive, labels (e.g. Page/Section vs Feature/Screen) |
| **Scope option groups** (per service) | Single or multiple choice; options with input type (toggle/quantity), default, locked flag, free units, rule (none, percent, fixed, per item) and value |
| **Categories** (per service) | e.g. Core pages, Commerce; Authentication, Settings |
| **Library items** | Name, category, base hours, default sub-items, allow multiple, **definition, included, excluded** (B1) |
| **Sub-items** | The service's sub-item library (e.g. website sections) with hours and definitions |
| **Starter packs** | Named bundles of items |
| **Gap rules** (A3) | When an item is selected or an option is turned on → suggest an item or option, with a message |
| **Global settings** | Overhead items (fixed or %), default buffer %, complexity multipliers, phases, default assumptions and exclusions, agency name for exports |

**History:** each estimate keeps a snapshot of the rates and item hours it was created with, so CMS changes never alter saved estimates. An estimate can be explicitly refreshed to the latest rates.

## 7. Data model

```
services/{serviceId}
  name, description, icon, order, active, labels
  categories[]   { id, name }
  items[]        { id, categoryId, name, hours, defaultSubs[], allowMultiple, description, includes, excludes }
  subItems[]     { id, name, hours, description, includes, excludes }
  optionGroups[] { id, name, description, selection, options[] { id, name, input, default, locked, free, min, max, unit, rule, value } }
  starterPacks[] { id, name, description, items[] }
  gapRules[]     { id, trigger { kind: item|option, ref, group }, suggest { kind: item|option, ref, group }, message }

config/settings
  complexity[] { id, name, multiplier }, overhead[] { id, name, rule, value, enabled },
  bufferPercent, phases[], defaultAssumptions[], defaultExclusions[], agencyName

estimates/{estimateId}
  name, client, status, serviceId, serviceName, totalHours, createdBy, updatedBy, createdAt, updatedAt,
  snapshot { labels, optionGroups, complexity, phases, gapRules }, scope { optionId: value },
  items[] (copies of selected items with sub-items, qty, complexity, priority, phase, notes),
  customDeliverables[], overhead[], bufferPercent,
  register { assumptions[], exclusions[], dependencies[], risks[] }, hiddenAuto[], dismissedSuggestions[]
```

The generic structure (**Service → Category → Item → Sub-item**) handles websites (Page → Section), apps (Module → Feature → Screen) and future services (e.g. Branding → Deliverable → Variation) without new code.

## 8. Export
- **CSV**: one flat table, one row per line (type, group, item, detail, quantity, unit hours, rate, multiplier, hours, priority, phase), ending with subtotal, overhead, buffer and total rows. Single sheet, no formulas.
- **XLSX**: workbook for Google Sheets and Excel:
  - `Summary`: project details, totals, scope scenarios, hours by phase, deliverables list
  - `Breakdown`: every line with **live formulas** (hours = qty × unit × multiplier; percent options reference base design; overhead references design subtotal; buffer references subtotal), so changing a quantity recalculates everything
  - `Assumptions`: scope options chosen with their rates, assumptions, exclusions, dependencies, risks, out-of-scope items

## 9. Business analysis & requirements engineering features (adopted)

> **Adopted 2026-10-17.** Phases: **v1** = in the current build · **v2** = next · **Later** = needs data or integrations first.

### A. Requirement intake
| # | Feature | What it does | Phase |
|---|---|---|---|
| A1 | **AI brief analyzer** (built) | Upload or paste a brief, RFP, PRD or call notes. AI extracts pages, features and journeys, matches them to library items and turns leftovers into custom items for review. | v2 |
| A2 | **Client discovery questionnaire** | A shareable form the client fills in; answers pre-fill Steps 1–2 and suggest library items. | v2 |
| A3 | **Gap & completeness checker** | CMS rules suggest related items or options: Login → Forgot password; Cart → Checkout; 2+ languages → RTL; Sign up → Delete account (app store requirement). | **v1** |
| A4 | **Clarifying questions generator** | Lists what's missing or ambiguous in the brief as ready-to-send client questions. | v2 |

### B. Scope definition
| # | Feature | What it does | Phase |
|---|---|---|---|
| B1 | **Item definitions & included/excluded scope** | Each library item carries a definition plus what's included and excluded; these auto-fill the estimate's assumptions and exclusions. | **v1** |
| B2 | **Assumptions, exclusions, dependencies & risks register** | Per-estimate lists, pre-filled from B1 and agency defaults, editable, included in exports. | **v1** |
| B3 | **Complexity levels** | Simple / Standard / Complex per item with CMS multipliers. | **v1** |
| B4 | **Non-functional scope options** | Accessibility level, handoff & specs, design QA rounds, as Step 2 option groups. | **v1** |
| B5 | **Auto sitemap / feature map** | Visual tree of the selection for client sign-off. | v2 |

### C. Prioritization & options
| # | Feature | What it does | Phase |
|---|---|---|---|
| C1 | **MoSCoW priorities & phases** | Must / Should / Could / Won't and phase per item; scope scenarios and hours per phase. | **v1** |
| C2 | **Tiered packages** (built) | Basic / Standard / Premium versions of one estimate, compared side by side. | v2 |
| C3 | **Budget fitter** | Enter a target; see what fits using C1 priorities. | v2 |

### D. Requirements documentation
| # | Feature | What it does | Phase |
|---|---|---|---|
| D1 | **User stories & acceptance criteria** | Template stories and criteria on library items; requirements document export. | v2 |
| D2 | **Traceability** (built) | Link each line item to its source requirement; traceability matrix in the XLSX. | v2 |

### E. Change & version management
| # | Feature | What it does | Phase |
|---|---|---|---|
| E1 | **Estimate versions & diff** (built) | v1, v2, v3 of a quote with +/− hours per item. | v2 |
| E2 | **Change request log** | Post-sign-off change requests with hours and status. | v2 |
| E3 | **Status pipeline** | Draft → In review → Sent → Won / Lost, with dashboard filters. | **v1** |

### F. Accuracy & learning
| # | Feature | What it does | Phase |
|---|---|---|---|
| F1 | **Actuals tracking** | Actual hours per item after delivery; variance report. | v2 |
| F2 | **Library calibration suggestions** | Suggest new defaults from actuals. | Later |
| F3 | **Similar past estimates** | Comparable past quotes as benchmarks. | Later |

### G. Collaboration & delivery
| # | Feature | What it does | Phase |
|---|---|---|---|
| G1 | **Review & approval** | Lead approval and line-item comments. | v2 |
| G2 | **Team & timeline** | Roles and capacity → duration and milestones. | v2 |
| G3 | **Client-facing proposal export** (built) | Branded PDF/doc with scope, deliverables, assumptions, timeline. | v2 |
| G4 | **Integrations** | Jira / Linear / ClickUp, CRM, Google Sheets sync. | Later |
| G5 | **Audit log** | Who changed what. | Later |

## 10. v1 release scope

### 10.1 In v1
- Sign-in and roles (Admin / Estimator)
- Estimates dashboard with search, status filter, duplicate and delete
- 4-step estimator: service → scope → build → review, with live total and autosave
- Pages → sections and modules → features, quantities, hour steppers, starter packs, custom items
- A3, B1, B2, B3, B4, C1, E3 (see §9)
- Admin CMS for services, option groups, categories, items, sub-items, starter packs and gap rules
- Global settings for overhead, buffer, complexity, phases and default assumptions/exclusions
- Rate snapshot per estimate with an explicit "refresh to latest rates"
- CSV and XLSX export (XLSX with live formulas)
- Starter library for Website, Mobile app and Web app, plus an inactive Branding service as an extensibility example

### 10.2 Working defaults (placeholders, editable in the CMS)
These answer the open calculation questions for v1. They should be replaced with the agency's own numbers.

| Setting | Default |
|---|---|
| Page hours | Page base hours (usually 0) + selected sections; pages without sections carry their own hours |
| Global elements | Header/navigation and footer are designed once as their own items, not per page |
| Mobile responsive (website) | +40% of base design |
| Mobile responsive (web app) | +45% of base design |
| Tablet responsive | +25% of base design |
| Second mobile platform | +30% of base design |
| Tablet layouts (mobile app) | +35% of base design |
| Each extra language | +15% of base design (first language free) |
| RTL support | +20% of base design |
| Light + Dark theme | +25% of base design |
| Design system / UI kit | +15% of base design |
| Interactive prototype | +10% of base design |
| Accessibility (WCAG 2.1 AA) | +8% of base design |
| Developer handoff & specs | +5% of base design (on by default) |
| Design QA round | 6h each (1 by default) |
| Custom illustration / animation / icon | 6h / 4h / 0.75h each |
| Complexity | Simple ×0.75 · Standard ×1.0 · Complex ×1.5 |
| Overhead | Requirement breakdown 6h · Project setup 3h · Meetings & presentations 8% · Feedback & iterations 15% |
| Buffer | 10% (adjustable per estimate) |
| Phases | Phase 1 (MVP) · Phase 2 · Phase 3 |
| Hour values | Single values (no ranges) in v1 |
| Services per estimate | One (combined multi-service quotes in v2) |
| Cost | Hours only in v1 |

## 11. Open questions
1. **Real numbers.** Replace §10.2 placeholders with the agency's own hours and percentages (ideally from past projects).
2. **Ranges.** Should a later version support min–max hours per item and show the total as a range?
3. **Multiple services per estimate.** Needed in v2 for combined quotes (e.g. Website + Branding)?
4. **Cost.** Add hourly rates per role and show price in v2?
5. **Client-facing export.** Is a separate client version needed before G3 (proposal export)?
6. **Team access.** Which colleagues need Admin vs Estimator access?

## 12. Non-goals (v1)
- Time tracking, invoicing, resource scheduling
- Development / QA estimation (possible future service via CMS)
- Client portal or share links
- Range estimates, cost/pricing, multi-service estimates

## 13. Technical approach (decided for v1)
- **Hosted web app on claude.ai** (a published artifact), so the team gets a working tool without separate hosting
- **Sign-in** via claude.ai accounts; roles from sharing levels (§3)
- **Shared database** (document store) holds services, settings and estimates; access rules allow only Admins to write the library and settings, and Admins and Estimators to write estimates
- **Live sync**: library and estimate changes appear for everyone without reloading
- **Exports** generated in the browser: CSV natively, XLSX with ExcelJS (formulas, formatting); files are saved through the browser's download prompt
- **Portability**: the data model is plain JSON, so a later move to a standalone deployment (own domain and login) can reuse it

## 14. Decision log
| Date | Decision |
|---|---|
| 2026-10-17 | Exports required: CSV + XLSX compatible with Google Sheets & Excel |
| 2026-10-17 | Core model is block-based: reusable library with preset hours, selected via checkboxes |
| 2026-10-17 | Add-ons, project overhead and a buffer (default 10–15%) are part of every estimate |
| 2026-10-17 | Users log in; the app has a backend admin CMS that feeds the estimator |
| 2026-10-17 | Flow: choose service → configure scope → build from library → review → export |
| 2026-10-17 | Scope options: Responsiveness, Localization (languages, RTL), Theming, Other deliverables |
| 2026-10-17 | Website library = pages with expandable sections, each section with default hours |
| 2026-10-17 | Custom items (feature, page, section, deliverable) can be added to any estimate |
| 2026-10-17 | Services are extensible via the CMS (e.g. branding, logo design, video production) |
| 2026-10-17 | Interaction should be click-first, minimizing manual entry |
| 2026-10-17 | **Adopted BA features**: v1 = A3, B1, B2, B3, B4, C1, E3; v2 = A1, A2, A4, B5, C2, C3, D1, D2, E1, E2, F1, G1, G2, G3; Later = F2, F3, G4, G5 |
| 2026-10-17 | **v1 tech**: hosted on claude.ai with claude.ai sign-in, shared database and role-based access |
| 2026-10-17 | **Roles**: Owner/Editor = Admin; Contributor = Estimator; Viewer/Commenter = no access |
| 2026-10-17 | **Working defaults** in §10.2 adopted for v1 until real numbers are available |
| 2026-10-17 | Header/navigation and footer are global items, designed once rather than per page |
| 2026-10-17 | Each estimate snapshots its rates; CMS changes don't alter saved estimates unless refreshed |
| 2026-10-17 | **v1 published** as "Design Hours Estimator"; starter library seeded (Website, Mobile app, Web app active; Branding inactive) |
| 2026-10-17 | Custom items default to a "Custom" group; admins can promote them to the library |
| 2026-10-17 | Adopt the Mintlify-style visual direction (§16) for all screens: sidebar navigation, pastel icon tiles, mint accent |
| 2026-10-17 | **Accessibility target: WCAG 2.1 AA** in both themes. Text and accent tokens darkened (accent `#0C8468`); light-theme feature card uses dark text on the gradient |
| 2026-10-17 | **Simultaneous edits merge**: when a teammate saves while you have unsaved edits, whatever you changed wins and everything else takes their version, field by field and row by row (items, deliverables, register lines) |
| 2026-10-17 | An estimate deleted by someone else is never recreated silently: the editor shows a banner and only **Restore it** brings it back |
| 2026-10-17 | **Number limits**: quantities are whole numbers (1–99 per line), hours up to 1,000 per line, percentages up to 100 (scope-option percentages up to 500) |
| 2026-10-17 | Accepted risk: the database's root write level must stay at Contributor so roles can be detected, which means an Estimator could write to unused collections; the app reads only `services`, `config` and `estimates`, and the library and settings remain Admin-only |

## 15. v1 build notes

### What shipped
| Area | Delivered |
|---|---|
| Sign-in & roles | claude.ai sign-in. Owner/Editor = Admin (Library, Settings); Contributor = Estimator; Viewer/Commenter see an access notice |
| Estimates dashboard | Search, status filters with counts, total hours of the filtered list, duplicate, delete with confirmation, owner avatars |
| Estimator | Service → Scope → Build → Review, live total in an inspector panel (bottom bar on phones), autosave, live sync between teammates |
| Build step | Library grouped by category, item definitions (info), starter packs, gap suggestions with Add/Dismiss, pages → sections with hour steppers, quantity, complexity, MoSCoW priority, phase, notes, custom items and sections, undo on remove, search and "selected only" filter |
| Review step | Total, scope scenarios (Must / +Should / +Could), hours by phase, full breakdown (sections on demand), deliverables list, overhead & buffer controls, assumptions/exclusions/dependencies/risks register (auto lines from item definitions can be left out), out-of-scope list, "update rates" when the library changed |
| Library (admin) | Services (details, labels, icon, active, duplicate, delete), categories, items with default sections and definitions, section library, scope option groups (single/multiple, toggle/quantity, rules: none, % of base, fixed, per item, free units), starter packs, gap rules |
| Settings (admin) | Agency name, default buffer, complexity multipliers, overhead items, phases, default assumptions and exclusions |
| Export | CSV (flat table with subtotal/total rows) and XLSX (Summary, Breakdown, Assumptions; totals are live formulas) via the browser's save prompt |

### Starter library (placeholder hours, see §10.2)
- **Website**: 25 pages in 5 groups, 31 reusable sections, 4 starter packs, 10 gap rules
- **Mobile application**: 33 features in 8 modules, 3 starter packs, 12 gap rules (incl. the App Store / Google Play account-deletion requirement)
- **Web application**: 29 features in 7 modules, 3 starter packs, 9 gap rules
- **Branding & logo**: inactive example showing how a non-UI service is modelled

### Verification
- Calculation engine checked against a hand-calculated reference estimate (exact match), plus option, scenario, phase, gap-rule and rate-refresh cases
- XLSX formulas independently recalculated in LibreOffice: all 56 formulas match the engine, no errors
- 53 automated interface checks across Admin, Estimator, view-only, signed-out and empty-library states; phone (400px) and desktop; light and dark themes; no console errors
- Live database: library and settings read back intact; access rules confirmed (Estimators can read the library, view-only users read nothing)
- QA hardening pass (v1.2): see §17

### Known limits
- Team members need access to the app on claude.ai; it is private until shared from its Share menu
- On claude.ai plans without a Contributor level, collaborators invited as Editors get Admin rights
- One service per estimate; hours only (no cost); single-value hours (no ranges)
- An estimate is one database document of at most 256 KB: about 360 website pages with sections, or about 700 app features. The app warns before saving anything larger
- If two people change the *same* field at the same moment, the last save wins; different fields and different rows merge

### Next
1. Record actual hours on delivered projects (Review → Actual hours) or load past timesheets in Library → Calibrate hours; both tools are built and need the agency's data
2. G1–G2 collaboration (comments, approvals) and E2 change requests
3. F2 estimator accuracy over time (needs a few tracked projects first)

## 16. Visual design direction

**References:** the provided UI samples (a category table with duotone icons and muted details in parentheses; Gridline-style menu cards with pastel icon tiles), Mintlify's web app style, and the [Mintlify web flows on Mobbin](https://mobbin.com/apps/mintlify-web-50c173bd-7543-431e-9021-cb064b29cfc9).

### Principles
- **Calm and airy.** Soft whites and subtle greys, generous spacing, few borders, very light shadows.
- **Colour lives in icon tiles.** Pastel tiles carry each service, group and section; the rest of the interface stays neutral.
- **One accent.** Mint green is reserved for primary actions, selection and the hours that count.
- **Progressive disclosure.** Rows stay compact; details (sections, definitions, breakdown lines) open on demand.

### Tokens
| Token | Light | Dark |
|---|---|---|
| Page ground | Off-white `#F6F6F4` | `#0C0D0F` |
| Card | White, 1px `#ECECEC` border, 16px radius, faint shadow | `#141619`, low-contrast border |
| Card header band | `#FAFAFA` | `#17191D` |
| Text / secondary / parenthetical | `#111316` / `#5A5F66` / `#6A6E74` | `#F4F4F5` / `#A1A1AA` / `#88888F` |
| Accent (Mintlify green) | `#0C8468` (white text 4.65:1) | `#07C983` (dark text) |
| Tile tints | Blue, green, orange, pink, purple, teal, red, yellow (pastel background, saturated icon; icon and text hues tuned to ≥ 4.5:1 on their tint) | Same hues at low opacity |
| Contrast | All text WCAG 2.1 AA (≥ 4.5:1), checked with axe on 14 screens and by pixel measurement on the gradient card | same |
| Type | Inter: 28/20/16 headings (600), 14 body, 13 secondary, 12 meta, uppercase 11 section labels | same |
| Radius | Cards 16px · panels 12px · controls 10px · tiles 9px · pills full | same |

### Components
- **Sidebar** (Mintlify): brand, New estimate, Workspace links (Estimates, Library, Settings) with icon tiles, recent estimates, user card with role. Collapses to a top bar on phones.
- **Cards with header bands** (reference 1): grey header row with title and meta; rows split by hairlines; primary label in ink, secondary detail in grey parentheses, e.g. *Home (7 sections)*, *Acme website (Acme Ltd)*.
- **Icon tiles** (reference 2): duotone filled icons for services; line icons in pastel tiles for groups and sections.
- **Menu-style service picker** (reference 2): tile + name + one-line description, two columns.
- **Feature card**: a soft mint-to-violet gradient card used once, on the dashboard ("Start an estimate"). Light theme: dark green text over a light scrim; dark theme: white text over a deeper scrim.
- **Pills**: status pills with a dot (Draft, In review, Sent, Won, Lost); hour pills (mint when counted, grey when not).
- **Controls**: segmented step switcher, mint switches and checkboxes, 10px-radius buttons (mint primary, white secondary).

### Applied in the app (v1.1)
- Sidebar with Workspace links, recent estimates and user card; top bar on phones
- Dashboard: gradient "Start an estimate" card with one-click service shortcuts; estimates table with service tiles and *Name (Client)* rows
- Each service has a colour (set in Library → Service details) used for its tile everywhere
- Scope, Build, Review, Library and Settings cards each carry a pastel icon tile; Build categories and Review breakdown use grey header bands and parenthetical details
- Light and dark themes; re-tested with the full interface suite (53 checks)

## 17. QA & hardening (v1.2)

A full Lead-QA pass covered the calculation engine, the data store and the interface, with stress and fault testing. Every finding was fixed and every suite re-run to green on the final build. Details, numbers and accepted risks are in **`qa-report.md`**.

| Layer | What was tested | Result |
|---|---|---|
| Engine | Hand-calculated reference; 600 random estimates against an independent second implementation; 25 corrupted-estimate cases; 224 corrupted library/settings combinations; CSV and XLSX validity | All pass |
| Spreadsheets | Formula-only workbooks recalculated in LibreOffice and compared with the engine | 0 differences |
| Data store | Live permission matrix (view-only, Contributor, Admin) on the real database | Matches §3 |
| Interface | 53 end-to-end checks + 42 QA scenarios (edge cases, faults, concurrency, security, keyboard) | All pass; QA suite green in three consecutive full runs |
| Accessibility | axe on 14 screens × 2 themes; pixel-measured contrast on the gradient card; 11 widths from 320 to 1920px | 0 violations |
| Performance | 500-estimate dashboard, 250-item estimate, 57 fast keystrokes on a slow network | Load about 1 s, toggles under 30 ms, 1 write |

**Behaviour added in this pass:** merging of simultaneous edits; a deleted-estimate banner with Restore; automatic reconnection when the live connection drops; immediate save when the tab is hidden; retries for busy and transient errors; a clear message before an estimate exceeds 256 KB; number limits; input length limits; and a recoverable error screen instead of a blank app.

### Motion (v1.3)
Motion follows Emil Kowalski's rules: animate only when it gives feedback, shows where something came from or stops a jarring change; keep it under 300ms; ease-out curves (`cubic-bezier(0.23, 1, 0.32, 1)`); transform and opacity only.
- Press feedback: buttons, chips, cards and tabs scale to 0.97 for 160ms
- Dialogs fade in and scale from 0.96 (200ms); dismissing is quicker (140ms) and confirming acts at once
- Toasts rise from and return to the bottom edge (260ms in, 180ms out)
- Item panels, definitions and CMS editors reveal in place (200ms); the unsaved-changes bar rises (240ms)
- First-run empty states settle with a 40ms stagger
- Not animated on purpose: totals and hour pills (data you read), checkbox toggles (dozens a day), step changes and the estimates list
- Reduced motion keeps fades and drops movement

## 18. v2 features (built)

| Feature | Where | How it works |
|---|---|---|
| **C2 Packages** | Review → Packages; Build → item panel → Package | Switch on to offer three packages (names editable, default Basic / Standard / Premium). Each item sits in the smallest package that includes it; packages are cumulative. Totals per package include scope options, overhead and buffer. Shown in CSV (Package rows), XLSX Summary and the proposal. The estimate's own total is the full scope. |
| **E1 Versions & diff** | Review → Versions | Save a named version (e.g. "Sent to client"). Compare shows added / removed / changed lines with before, now and ± hours, plus overhead and buffer changes. Restore saves the current state first. Versions live in their own documents (`estimates/{id}/versions/*`), so they don't count against the 256 KB estimate limit, and are deleted with the estimate. |
| **D2 Requirements & traceability** | Review → Requirements; Build → item panel → Requirements | Requirements (R1, R2…) come from the brief analyzer or are typed in. Items link to one or more requirements; the panel shows coverage ("2 not covered") and can create a custom item for an uncovered one. The XLSX gets a Traceability sheet (requirement → items → hours, plus unlinked items). |
| **A1 Brief analyzer** | Build → Analyze a client brief | Paste or open a brief (.txt/.md). Claude (running in the page, on the viewer's own account, after they allow it) maps it to the service's library: library matches with quantities, custom items with hours, scope options and open questions, each linked to the requirement it came from. Nothing is added until the person reviews and unticks; questions go to Dependencies. Hidden when Claude isn't available; Stop cancels. |
| **G3 Client proposal** | Review → Export → Client proposal | A preview of the client-facing document: intro, summary (design, management, contingency, total, duration), packages, scope by group (hours per line optional), deliverables, timeline by phase (weeks at a chosen weekly capacity), assumptions, exclusions, dependencies, risks, not included, validity and a signature block. Downloads as Word (.docx) for letterhead or PDF. |
| **Calibration** | Library → service → Calibrate hours | Paste or open a CSV of past work (this tool's CSV export, or any sheet with a name and an hours column). Rows match library items by name; the table shows library hours vs the past median and range, with a suggested new base. Apply, then Save changes. |

**Verification:** 7 end-to-end scenarios for these features (packages and exports, versions round trip and cleanup, requirements and Traceability sheet, brief analyzer review/apply, Stop/errors/absence, proposal options and Word content, calibration to saved library), plus the full regression suites (53 UI checks, 42 QA scenarios, 600-estimate engine fuzz, axe 0 violations on 28 audits).

## 19. F1 actuals tracking (built, v1.1)

**Where:** Review step → **Actual hours** panel. Shown open when the estimate's status is Won or once any actual is recorded; otherwise a "Track actual hours" button.

**What it records** (`estimate.actuals`):
- `items`: actual hours per included item, keyed by the item's key. Blank means not tracked yet; 0 is allowed (the item was dropped).
- `other`: actual project time for everything that isn't an item (scope options, overhead, buffer: meetings, feedback, handoff).
- `note`: optional free text.

**What it shows:**
- Per line: estimated hours, actual hours, difference in %. Within ±10% shows green; over shows red; under shows blue.
- Summary: estimated, actual and difference. Until every line and project time are filled, the comparison covers tracked items only and says so; a pill shows "n of m tracked" or "Tracked".

**Timesheet import:** paste or open a CSV with a name column and an hours column. Rows for the same item are summed; names match exactly or by whole word ("Contact page" → Contact). Unmatched rows (calls, syncs) are added to project time and listed in the confirmation.

**Export:** the Excel workbook gains an **Actuals** sheet (estimated, actual, difference and difference % as live formulas, plus a total) when any actual is recorded.

**Calibration feed:** Library → Calibrate hours lists the tracked estimates for that service and includes them by default (switchable), alongside any pasted CSV.
- Actuals are scaled back to quantity 1 at Standard complexity (actual ÷ (quantity × complexity multiplier)).
- They are matched by library id, so renamed items still count.
- 0h actuals are not used as samples.

**Verified:** engine tests (summary maths, matching, scaling, rename-safe matching, XLSX sheet); 3 end-to-end scenarios (typing and decimal entry, import and summing, clearing, invalid input, persistence, 360px layout, calibration from tracked estimates); full regression (53 UI checks, 42 QA, 7 v2 scenarios, axe 0 violations, 143 responsive checks).

**Fixed alongside:** a v1.0 edit had cut the opening of a CSS comment. The leftover apostrophe stopped the browser parsing the rest of the stylesheet, so the §16 motion and polish rules were off in Version 6. They are restored, and `test/css.check.js` now fails the build if the stylesheet stops parsing early.

## 20. Standalone app (v1.2)

**Decided:** Supabase (Postgres, Auth, Realtime) + Vercel (static hosting). Sign-in with Google and email/password. Brief analyzer dropped for now. Code in a GitHub repository with a deploy guide (README).

**Approach:** the app code is unchanged. A web runtime (`web/runtime.js`) provides the same interface the claude.ai runtime gave the app: documents by path with live updates, user profiles and downloads. It also adds `team` (members, invites, sign-out, backups). One codebase builds both the claude.ai artifact (`build.js`) and the standalone site (`web/build.js`).

**Data:** one `docs` table (path, parent, id, JSON data) with four database functions: get, query (ordered, limited), set (validates path, object, 256 KiB limit, permission) and delete. Plus `members`, `invites` and `team_settings`.

**Access** (enforced by row-level security):
- **Admins** write the library, settings and team.
- **Estimators** write estimates.
- **Pending and removed accounts** see nothing.

**Sign-up roles:**
- The first account becomes admin, serialised so two simultaneous sign-ups can't both become admin.
- Invited emails get their invited role.
- Google sign-ins on the company domain get the domain role.
- Everyone else waits for approval.
- Admins cannot demote themselves.
- Role changes take effect in open sessions immediately.

**Migration:** Settings → Backup imports a JSON backup. The claude.ai library, settings and estimates were exported to `estimator-backup-from-claude.json`. `seed/starter-backup.json` holds the starter library.

**Security:** the publishable key is public by design. A Content Security Policy is generated per deploy and allows only the configured Supabase project; X-Frame-Options is DENY; email confirmation should stay on. Libraries are vendored and served from the app's own domain.

**Verified:**
- 56 database checks on real Postgres 16.
- 10 end-to-end scenarios of the built site against real PostgREST, with stand-ins for Auth (password, sign-up, confirmation, reset, Google PKCE) and Realtime (live sync, reconnect catch-up).
- Full regression of the shared app: 53 UI checks, 42 QA scenarios, 7 v2 and 3 F1 scenarios, axe 0 violations, 143 responsive checks.

**Open:**
- Brief analyzer through a Supabase Edge Function with an Anthropic API key.
- Invitation emails sent from the app.
- Free Supabase projects pause after a week without use, so Pro is recommended.

