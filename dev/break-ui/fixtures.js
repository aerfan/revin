// Break-UI fixtures (dev only, never published). Each dataset is a full seed for the mock data store
// (test/mock-claude.js) plus the people the `user` capability returns. Same shapes as seed/seed.json.
// Every value is something a real team could produce in this app, or the longest value its forms accept.
const path = require('path');
const E = require(path.join(__dirname, '..', '..', 'src', 'engine.js'));
const SEED = require(path.join(__dirname, '..', '..', 'seed', 'seed.json'));

const clone = (o) => JSON.parse(JSON.stringify(o));
const NOW = Date.UTC(2026, 9, 17, 9, 30); // fixed clock so relative times are stable; the harness pins Date.now to it
const MIN = 60000, HOUR = 60 * MIN, DAY = 24 * HOUR;
const svgData = (w, h, fill) => 'data:image/svg+xml;utf8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" fill="${fill}"/><circle cx="${w / 2}" cy="${h / 2}" r="${Math.min(w, h) / 3}" fill="#fff" opacity=".6"/></svg>`);
const AVATAR_OK = svgData(40, 40, '#6a8');
const AVATAR_PANORAMA = svgData(400, 40, '#a68');            // 10:1 image used as an avatar
const AVATAR_404 = 'https://avatars.example.com/u/9f8e7d6c-5b4a-4c3d-8e2f-1a0b9c8d7e6f.png';

function svc(id) { return Object.assign({ id }, clone(SEED['services/' + id])); }
function estimateFor(service, settings, meta, build) {
  const s = Object.assign({ id: service.id }, service);
  const est = E.createEstimate(s, service.id, settings, meta);
  if (build) build(est, s);
  est.totalHours = E.round(E.compute(est).total, 1);
  return est;
}
function add(est, s, id, patch) {
  const li = s.items.find((x) => x.id === id);
  if (!li) throw new Error('fixture item missing: ' + id);
  const it = E.copyItem(s, li, est);
  Object.assign(it, patch || {});
  est.items.push(it);
  return it;
}
function stamp(est, updatedAt, createdBy, extra) { return Object.assign(est, { updatedAt, createdAt: updatedAt - DAY, createdBy, updatedBy: createdBy }, extra || {}); }
function strip(o) { const c = clone(o); delete c.id; return c; }

// ---------------------------------------------------------------- Demo (what the app was designed against)
function demo() {
  const seed = clone(SEED), settings = seed['config/settings'];
  const w = svc('website'), m = svc('mobile-app');
  const acme = estimateFor(w, settings, { name: 'Acme corporate site', client: 'Acme Ltd', userId: 'u_me' }, (est, s) => {
    ['header', 'footer', 'home', 'about', 'services', 'service-detail', 'contact', 'pricing', 'blog-list'].forEach((id) => add(est, s, id));
    est.items[5].qty = 3; est.items[7].priority = 'should'; est.items[8].priority = 'wont'; est.items[4].complexity = 'complex';
    Object.assign(est.scope.values, { tablet: true, languages: 2, illustrations: 3 }); est.scope.choice.theming = 'both';
    est.customDeliverables.push({ key: 'c1', name: 'Brand workshop', qty: 1, hours: 8 });
    est.register.risks.push({ id: 'r1', text: 'Content may arrive late' });
  });
  const bloom = estimateFor(m, settings, { name: 'Bloom mobile app', client: 'Bloom Health', userId: 'u_me' }, (est, s) => {
    s.items.slice(0, 8).forEach((li) => add(est, s, li.id));
  });
  seed['estimates/est-focus'] = strip(stamp(acme, NOW - 5 * MIN, 'u_me', { status: 'sent' }));
  seed['estimates/est-b'] = strip(stamp(bloom, NOW - DAY, 'u_me', { status: 'won' }));
  return { seed, me: {}, people: {} };
}

// ---------------------------------------------------------------- Worst case
const LONG_ASSUMPTION = 'The client provides final, approved copy for every page in English and Bangla through the staging CMS before design starts; '
  + 'copy that arrives after the agreed content freeze is designed in the next sprint and may need a change request. '
  + 'Legal and compliance teams review each screen once, within five working days, and consolidate their comments in a single document. '
  + 'Brand guidelines, logo files, fonts with web licences and the photography library are shared in their original formats in the first week. '
  + 'The engineering team confirms technical constraints (API limits, SDK versions, supported devices and browsers) before the UI design phase. '
  + 'Any third-party integration screens (payment gateways, identity verification, maps) follow the provider\'s own guidelines. '
  + 'Usability testing recruits are sourced by the client. Translations into further languages are supplied by the client\'s agency.';
function worstSettings() {
  const st = clone(SEED['config/settings']);
  st.agencyName = 'Northwind Product Studio Ltd. (Dhaka · London · Dubai)';
  st.bufferPercent = 12.5;
  st.complexity = [
    { id: 'simple', name: 'Simple', multiplier: 0.75, description: 'Standard patterns, few states' },
    { id: 'standard', name: 'Standard', multiplier: 1, description: 'Typical effort' },
    { id: 'complex', name: 'Complex', multiplier: 1.5, description: 'Custom interactions, many states or heavy data' },
    { id: 'regulated', name: 'Highly complex (regulated / enterprise)', multiplier: 2.25, description: 'Banking, healthcare or government work with audit trails, approvals and compliance reviews' },
  ];
  st.overhead = [
    { id: 'requirements', name: 'Requirement breakdown, stakeholder workshops & discovery sprints', rule: 'fixed', value: 24, enabled: true, description: 'Brief review, feature breakdown, stakeholder interviews and a written requirements summary signed off by the client' },
    { id: 'setup', name: 'Project setup', rule: 'fixed', value: 3, enabled: true, description: '' },
    { id: 'meetings', name: 'Meetings & presentations', rule: 'percent', value: 8, enabled: true, description: 'Kick-off, reviews and design presentations' },
    { id: 'feedback', name: 'Feedback & iterations', rule: 'percent', value: 15, enabled: true, description: 'Revision rounds after client feedback' },
    { id: 'qa', name: 'Design QA', rule: 'percent', value: 5, enabled: false, description: '' },
    { id: 'handoff', name: 'Handoff to development (specs, redlines and Figma Dev Mode annotations)', rule: 'fixed', value: 16, enabled: true, description: 'Includes two walkthrough calls with the engineering team' },
  ];
  st.phases = ['Phase 1 (MVP)', 'Phase 2 — post-launch improvements and feature parity with the web app', 'Phase 3', 'Phase 3'];
  st.defaultAssumptions = [
    'The client provides final copy in the staging CMS at https://staging.example.com/cms/content-inventory/2026-q4?view=all&locale=bn-BD before design starts',
    LONG_ASSUMPTION,
    'None',
  ];
  st.defaultExclusions = ['Copywriting', 'Development, QA & deployment (quoted separately by the engineering team in its own statement of work)'];
  return st;
}
function worstWebsite() {
  const w = svc('website');
  w.name = 'Corporate & e-commerce websites (multilingual, CMS-driven)';
  w.description = 'Marketing, corporate, campaign and e-commerce websites on a headless CMS, with multilingual content models, SEO landing pages and a component-based design system.';
  const cat = Object.fromEntries(w.categories.map((c) => [c.id, c]));
  cat.global.name = 'Global elements & design-system foundations (shared across every page)';
  cat.content.name = 'Inhalte & Kampagnen';
  const it = Object.fromEntries(w.items.map((x) => [x.id, x]));
  it.header.includes = 'SEO-friendly navigation labels\nCTA button states\niOS Safari sticky behaviour';
  it.home.description = 'The main landing page of the site. It introduces the brand, routes visitors to the main journeys (shop, learn, contact) and carries the seasonal campaign slots that marketing updates every month, so every section must work with and without imagery and with copy in English and Bangla, which runs about 30% longer in some modules.';
  it.home.includes = 'SEO metadata and Open Graph image\nAPI-driven campaign slots';
  it.about.name = 'Über uns';
  it.services.name = 'Services overview with filterable capability matrix and case-study carousel';
  it['service-detail'].allowMultiple = true;
  it.contact.name = 'Kontaktformular mit Terminbuchung';
  it.cart.name = '🛒 Cart';
  it.checkout.name = 'Checkout (guest, account, express pay: Apple Pay, Google Pay, bKash, Nagad)';
  it.checkout.hours = 120;
  it.checkout.includes = 'KYC step for orders above the regulatory limit\n3-D Secure challenge screens';
  it['not-found'].name = '404';
  it.legal.name = 'Datenschutzerklärung';
  it.cookie.hours = 0.25;
  w.items.push(
    { id: 'notification-settings', categoryId: 'utility', name: 'Benachrichtigungseinstellungen', hours: 6, defaultSubs: [], allowMultiple: false, description: '', includes: '', excludes: '' },
    { id: 'qa-page', categoryId: 'utility', name: 'Q&A', hours: 3, defaultSubs: ['faq'], allowMultiple: false, description: '', includes: '', excludes: '' },
    { id: 'design-system', categoryId: 'global', name: 'Design system foundations (tokens, type scale, grid, 120+ components)', hours: 320, defaultSubs: [], allowMultiple: false, description: 'A token-based component library in Figma.', includes: 'UI kit with light and dark themes\nWCAG 2.2 AA colour pairs', excludes: 'Code components' },
  );
  const sub = Object.fromEntries(w.subItems.map((x) => [x.id, x]));
  sub.hero.name = 'Hero with video background, animated headline and dual CTA (desktop + mobile variants)';
  sub.stats.hours = 2.25;
  const loc = w.optionGroups.find((g) => g.id === 'localization');
  loc.options.find((o) => o.id === 'rtl').name = 'Right-to-left (RTL) mirroring for Arabic, Hebrew, Urdu and Persian';
  w.optionGroups.find((g) => g.id === 'responsive').name = 'Responsive breakpoints & devices';
  w.optionGroups.find((g) => g.id === 'responsive').options.push({ id: 'tv', name: 'Large desktop / TV (≥ 1920px)', input: 'toggle', rule: 'percent', value: 10, default: false, locked: false, free: 0, min: 0, max: 99, unit: '', description: 'Layouts stretched for kiosks, TVs and 4K monitors.' });
  w.optionGroups.push({ id: 'compliance', name: 'Accessibility & compliance (WCAG 2.2 AA, EN 301 549, Section 508)', selection: 'multiple', description: 'Annotations and flows auditors ask for in regulated industries such as banking, insurance and the public sector.', options: [
    { id: 'annotations', name: 'Accessibility annotations for every screen (focus order, landmarks, alt text, reading order)', input: 'toggle', rule: 'percent', value: 25, default: false, locked: false, free: 0, min: 0, max: 99, unit: '', description: 'Required by most public-sector tenders.' },
    { id: 'sr-flows', name: 'Screen-reader flows', input: 'quantity', rule: 'fixed', value: 40, default: 0, locked: false, free: 0, min: 0, max: 99, unit: 'flow', description: '' },
  ] });
  w.starterPacks = w.starterPacks.concat([
    ['fintech', 'Fintech onboarding (KYC, e-signature, account opening)', ['home', 'contact', 'legal', 'checkout']],
    ['blog', 'Blog', ['blog-list', 'blog-article']], ['docs', 'Docs', ['search-results', 'legal']], ['careers', 'Careers', ['careers']],
    ['events', 'Events', ['landing']], ['ir', 'Investor relations', ['about', 'legal']], ['help', 'Help centre', ['qa-page', 'search-results']],
    ['partners', 'Partner portal', ['account']], ['micro', 'Micro-site', ['home', 'thank-you']],
  ].map(([id, name, items]) => ({ id, name, description: '', items })));
  w.gapRules.push({ id: 'w-kyc', trigger: { kind: 'item', ref: 'checkout' }, suggest: { kind: 'item', ref: 'legal' }, message: 'Checkouts that collect identity documents for high-value orders usually need a privacy notice and consent screen; regulators in Bangladesh and the EU expect it before the first payment is taken, and payment providers ask for it during onboarding.' });
  w.gapRules[0].message = '';
  return w;
}
function worstMobile() {
  const m = svc('mobile-app');
  m.name = 'Mobile app (iOS + Android, React Native)';
  m.labels = { category: 'Product area', item: 'Screen & user flow', items: 'Screens & user flows', sub: 'Component state', subs: 'Component states' };
  m.items[0].name = '🎁 Rewards & referral programme';
  m.items[1].name = 'Account settings & notification preferences (email, push, in-app)';
  return m;
}
function worstArabic() {
  return {
    id: 'store-ar', name: 'متجر إلكتروني', description: 'تصميم متجر إلكتروني متكامل مع دعم اللغة العربية والاتجاه من اليمين إلى اليسار', icon: 'globe', color: 'teal', order: 5, active: true,
    labels: { category: 'مجموعة', item: 'صفحة', items: 'صفحات', sub: 'قسم', subs: 'أقسام' },
    categories: [{ id: 'main', name: 'الصفحات الرئيسية' }],
    subItems: [{ id: 'banner', name: 'لافتة العروض', hours: 3, description: '', includes: '', excludes: '' }],
    items: [
      { id: 'home', categoryId: 'main', name: 'الصفحة الرئيسية', hours: 8, defaultSubs: ['banner'], allowMultiple: false, description: 'الواجهة الأولى للمتجر', includes: '', excludes: '' },
      { id: 'cart', categoryId: 'main', name: 'سلة التسوق (Cart)', hours: 6, defaultSubs: [], allowMultiple: false, description: '', includes: '', excludes: '' },
    ],
    optionGroups: [], starterPacks: [], gapRules: [],
  };
}
function worstBangla() {
  return {
    id: 'brand-bn', name: 'ব্র্যান্ডিং ও লোগো ডিজাইন', description: 'লোগো, ব্র্যান্ড গাইডলাইন এবং সোশ্যাল মিডিয়া টেমপ্লেট', icon: 'palette', color: 'magenta', order: 6, active: true,
    labels: { category: 'বিভাগ', item: 'ডেলিভারেবল', items: 'ডেলিভারেবলস', sub: 'অংশ', subs: 'অংশসমূহ' },
    categories: [{ id: 'identity', name: 'পরিচিতি' }],
    subItems: [],
    items: [{ id: 'logo', categoryId: 'identity', name: 'লোগো ডিজাইন (৩টি কনসেপ্ট)', hours: 24, defaultSubs: [], allowMultiple: false, description: '', includes: '', excludes: '' }],
    optionGroups: [], starterPacks: [], gapRules: [],
  };
}
function worstUx() {
  return { id: 'ux', name: 'UX', description: '', order: 7, active: true, labels: clone(E.DEFAULT_LABELS),
    categories: [{ id: 'general', name: 'General' }], subItems: [],
    items: [{ id: 'audit', categoryId: 'general', name: 'Heuristic audit', hours: 16, defaultSubs: [], allowMultiple: false, description: '', includes: '', excludes: '' }],
    optionGroups: [], starterPacks: [], gapRules: [] };
}

function worst() {
  const settings = worstSettings();
  const w = worstWebsite(), m = worstMobile(), ar = worstArabic(), bn = worstBangla(), ux = worstUx(), wa = svc('web-app');
  const seed = { 'config/settings': settings, 'services/branding': clone(SEED['services/branding']) };
  [w, m, ar, bn, ux, wa].forEach((s) => { seed['services/' + s.id] = strip(s); });
  const P2 = settings.phases[1];

  const focus = estimateFor(w, settings, { name: 'Bangladesh Telecom super-app redesign — Phase 2 (onboarding, KYC, payments, rewards)', client: 'Northwind Industries Holdings International Ltd. (APAC)', userId: 'u_bart' }, (est, s) => {
    s.items.forEach((li) => add(est, s, li.id));
    const by = (id) => est.items.find((i) => i.libId === id);
    by('service-detail').qty = 12;
    by('checkout').complexity = 'regulated';
    by('home').complexity = 'regulated';
    by('blog-list').priority = 'could';
    by('careers').priority = 'wont';
    by('case-list').priority = 'should';
    ['pdp', 'plp', 'cart', 'checkout', 'order-confirmation', 'account'].forEach((id) => { by(id).phase = P2; });
    by('home').note = 'Client brief: https://drive.example.com/drive/folders/1a2B3c4D5e6F7g8H9i0J?usp=sharing — hero must support 3 campaign variants';
    by('header').subs.push({ key: 'sx1', libId: null, name: 'WebViewIntegrationForPartnerOffersAndLoyaltyPoints', hours: 2.25, description: '', includes: '', excludes: '' });
    est.items.push(E.customItem('Loan EMI calculator with amortisation schedule export (PDF + XLSX)', 48, 'commerce', 'Commerce', est));
    est.items.push(E.customItem('WebViewIntegrationForPartnerOffers', 12, 'custom', 'Custom', est));
    est.items.push(E.customItem('✨ Lucky draw', 6, 'custom', 'Custom', est));
    Object.assign(est.scope.values, { tablet: true, languages: 12, rtl: true, illustrations: 40, annotations: true, 'sr-flows': 3 });
    est.scope.choice.theming = 'both';
    est.customDeliverables.push(
      { key: 'c1', name: 'Brand workshop with C-level stakeholders (2 × half-day, on site in Dhaka)', qty: 2, hours: 8 },
      { key: 'c2', name: '', qty: 1, hours: 4 },
      { key: 'c3', name: 'Motion', qty: 99, hours: 10 },
    );
    est.register.dependencies.push({ id: 'd1', text: 'API documentation from the bank\'s core-banking vendor' });
    est.register.risks.push({ id: 'r1', text: '⚠️ Regulator (BTRC) approval may change the onboarding flow after design sign-off' });
    est.register.exclusions.push({ id: 'x1', text: 'https://example.com/workspaces/acme/projects/q3-launch/docs/9f8e7d6c5b4a?tab=comments&filter=unresolved' });
  });
  seed['estimates/est-focus'] = strip(stamp(focus, NOW - 3 * MIN, 'u_bart', { status: 'review' }));

  const rows = [
    // [id, service, name, client, status, updatedAt, createdBy, totalHoursOverride, build]
    ['q4', wa, 'Q4', '', 'won', NOW - 2 * HOUR, 'u_jo', 0],
    ['ar', ar, 'متجر إلكتروني للأزياء', 'شركة النور للتجارة (الرياض)', 'sent', NOW - 12 * DAY, 'u_rtl', 1284.5],
    ['bn', bn, 'বিকাশ মার্চেন্ট অ্যাপ রিডিজাইন', 'বিকাশ লিমিটেড', 'draft', NOW - 3 * 365 * DAY, 'u_emoji', 4830.5],
    ['rfp', m, 'RFP response', 'bartholomew.fitzgerald@northwind-industries-holdings.example.com', 'lost', NOW + 2 * DAY, 'u_missing', 96],
    ['emoji', ux, '🚀 Launch microsite', 'Acme', 'archived', NOW - 40 * MIN, 'u_me', 12.25],
    ['blank', ux, '   ', 'Contoso', 'draft', 0, 'u_jo', 40],
    ['de', w, 'Relaunch der Unternehmenswebsite inkl. Barrierefreiheitsüberprüfung', 'Müller & Söhne Maschinenbau GmbH & Co. KG', 'review', NOW - 6 * DAY, 'u_emoji', 312],
    ['dup1', wa, 'Website redesign', 'Globex', 'draft', NOW - 7 * DAY, 'u_jo', 120],
    ['dup2', wa, 'Website redesign', 'Globex', 'draft', NOW - 7 * DAY - 5 * MIN, 'u_jo', 132],
    ['file', wa, 'IMG_20250914_183022_brief_v12_FINAL_approved_by_legal', 'Initech', 'sent', NOW - 26 * DAY, 'u_bart', 64],
    ['gone', { id: 'video', name: 'Video production (discontinued)' }, 'Brand film', 'Umbrella Corp', 'won', NOW - 400 * DAY, 'u_missing', 75],
    ['html', ux, '<b>Bold</b> & Co. — R&D portal', 'AT&T', 'review', NOW - 50 * MIN, 'u_me', 18],
  ];
  rows.forEach(([id, s, name, client, status, at, by, total]) => {
    const live = s.items ? s : null;
    const est = live ? estimateFor(Object.assign({ id: s.id }, s), settings, { name, client, userId: by }) : E.createEstimate({ id: s.id, name: s.name, items: [], optionGroups: [] }, s.id, settings, { name, client, userId: by });
    est.serviceName = s.name; est.serviceId = s.id;
    if (id === 'ar') { const a = Object.assign({ id: ar.id }, ar); add(est, a, 'home'); add(est, a, 'cart'); }
    stamp(est, at, by, { status, totalHours: total });
    seed['estimates/est-' + id] = strip(est);
  });

  const people = {
    u_bart: { name: 'Christopher Alexander Montgomery III', avatarUrl: AVATAR_404 },
    u_jo: { name: 'Jo', avatarUrl: '' },
    u_rtl: { name: 'نور الهدى عبد الرحمن', avatarUrl: AVATAR_OK },
    u_emoji: { name: '👩🏽‍💻 Priya', avatarUrl: AVATAR_PANORAMA },
    u_missing: { name: '', avatarUrl: '' },
    u_me: { name: 'Aleksandra Wiśniewska-Kowalczyk', avatarUrl: '' },
  };
  return { seed, me: { name: 'Aleksandra Wiśniewska-Kowalczyk', avatarUrl: '' }, people };
}

// ---------------------------------------------------------------- Empty
function empty() {
  const seed = clone(SEED);
  seed['services/discovery'] = { name: 'Discovery workshop', description: '', icon: 'pen', color: 'pink', order: 9, active: true, labels: clone(E.DEFAULT_LABELS), categories: [], subItems: [], items: [], optionGroups: [], starterPacks: [], gapRules: [] };
  seed['config/settings'] = { agencyName: '', bufferPercent: 0, complexity: clone(E.DEFAULT_COMPLEXITY), overhead: [], phases: [], defaultAssumptions: [], defaultExclusions: [] };
  return { seed, me: {}, people: {} };
}

// ---------------------------------------------------------------- One (every count is exactly 1)
function one() {
  const w = svc('website');
  const hero = w.subItems.find((s) => s.id === 'hero');
  const one = {
    id: 'website', name: 'Website', description: 'One of everything.', icon: 'globe', color: 'blue', order: 1, active: true, labels: clone(w.labels),
    categories: [{ id: 'core', name: 'Core pages' }], subItems: [hero],
    items: [Object.assign(clone(w.items.find((i) => i.id === 'home')), { defaultSubs: ['hero'], hours: 1 })],
    optionGroups: [{ id: 'localization', name: 'Localization', selection: 'multiple', description: '', options: [Object.assign(clone(w.optionGroups.find((g) => g.id === 'localization').options[0]), { default: 1 })] }],
    starterPacks: [{ id: 'p1', name: 'Starter', description: '', items: ['home'] }], gapRules: [],
  };
  const settings = { agencyName: 'Studio', bufferPercent: 1, complexity: [{ id: 'standard', name: 'Standard', multiplier: 1, description: '' }],
    overhead: [{ id: 'setup', name: 'Project setup', rule: 'fixed', value: 1, enabled: true, description: '' }], phases: ['Phase 1'],
    defaultAssumptions: ['One revision round'], defaultExclusions: ['Copywriting'] };
  const seed = { 'config/settings': settings, 'services/website': strip(one) };
  ['mobile-app', 'web-app', 'branding'].forEach((id) => { seed['services/' + id] = Object.assign(clone(SEED['services/' + id]), { active: false }); });
  const est = estimateFor(one, settings, { name: 'One page site', client: 'Solo', userId: 'u_me' }, (e, s) => {
    add(e, s, 'home');
    e.customDeliverables.push({ key: 'c1', name: 'Logo tweak', qty: 1, hours: 1 });
    e.register.risks.push({ id: 'r1', text: 'One risk' });
  });
  seed['estimates/est-focus'] = strip(stamp(est, NOW - MIN * 1.5, 'u_me', { status: 'draft' }));
  return { seed, me: {}, people: {} };
}

// ---------------------------------------------------------------- 1,000 rows (and an estimate near the size limit)
function huge() {
  const seed = clone(SEED), settings = seed['config/settings'];
  const w = svc('website');
  const statuses = E.STATUSES.map((s) => s.id);
  const clients = ['Acme', 'Globex', 'Initech', 'Umbrella', 'Hooli', 'Stark Industries', 'Wayne Enterprises', 'Soylent', 'Tyrell', 'Cyberdyne'];
  const base = estimateFor(w, settings, { name: 'x', client: 'x', userId: 'u_me' }, (est, s) => { ['header', 'home', 'contact'].forEach((id) => add(est, s, id)); });
  for (let i = 0; i < 1000; i++) {
    seed['estimates/bulk-' + String(i).padStart(4, '0')] = strip(Object.assign(clone(base), {
      name: ['Website refresh', 'Campaign landing page', 'Customer portal', 'Mobile banking app', 'Design system audit'][i % 5] + ' #' + (1000 - i),
      client: clients[i % clients.length], status: statuses[i % statuses.length], totalHours: 8 + (i * 37) % 900,
      updatedAt: NOW - i * 3 * HOUR, createdAt: NOW - i * 3 * HOUR - DAY, createdBy: 'u_me', updatedBy: 'u_me',
    }));
  }
  const big = estimateFor(w, settings, { name: 'Enterprise portal (250 pages)', client: 'Globex', userId: 'u_me' }, (est, s) => {
    s.items.forEach((li) => add(est, s, li.id));
    while (est.items.length < 250) est.items.push(E.customItem('Extra page ' + est.items.length, 3, 'custom', 'Custom', est));
  });
  seed['estimates/est-focus'] = strip(stamp(big, NOW, 'u_me', { status: 'draft' }));
  return { seed, me: {}, people: {} };
}

function backup() {
  const fs = require('fs');
  const backupFile = path.join(__dirname, '..', '..', 'estimator-backup-from-claude.json');
  if (fs.existsSync(backupFile)) {
    try {
      const raw = JSON.parse(fs.readFileSync(backupFile, 'utf8'));
      if (raw && raw.docs) {
        return { seed: raw.docs, me: { id: 'u_me', name: 'Arfan Uddin', email: 'aerfan.work@gmail.com' }, people: {} };
      }
    } catch (e) {
      console.warn('Failed to parse backup json', e);
    }
  }
  return demo();
}

const DATASETS = { backup: backup(), demo: demo(), worst: worst(), empty: empty(), one: one(), huge: huge() };
module.exports = { DATASETS, NOW };
if (require.main === module) {
  for (const [k, v] of Object.entries(DATASETS)) {
    const docs = Object.keys(v.seed);
    const est = docs.filter((d) => d.startsWith('estimates/'));
    const bytes = Math.max(...docs.map((d) => Buffer.byteLength(JSON.stringify(v.seed[d]))));
    console.log(`${k.padEnd(6)} ${docs.length} docs · ${est.length} estimates · largest doc ${Math.round(bytes / 1024)} KB` + (v.seed['estimates/est-focus'] ? ` · focus total ${v.seed['estimates/est-focus'].totalHours}h, ${v.seed['estimates/est-focus'].items.length} items` : ''));
  }
}
