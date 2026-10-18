// Builds the starter library + settings documents for the Design Hours Estimator.
// Output: seed/seed.json  →  { "<doc path>": { ...document } }
// All hours and percentages are placeholders (PRD §10.2) meant to be replaced in the CMS.
const fs = require('fs');
const path = require('path');

const sub = (id, name, hours, x = {}) => ({
  id, name, hours,
  description: x.d || '', includes: x.inc || '', excludes: x.exc || '',
});
const item = (id, categoryId, name, hours, x = {}) => ({
  id, categoryId, name, hours,
  defaultSubs: x.subs || [], allowMultiple: !!x.multi,
  description: x.d || '', includes: x.inc || '', excludes: x.exc || '',
});
const opt = (id, name, input, rule, value, x = {}) => ({
  id, name, input, rule, value,
  default: x.def !== undefined ? x.def : (input === 'quantity' ? 0 : false),
  locked: !!x.locked, free: x.free || 0, min: x.min !== undefined ? x.min : 0, max: x.max !== undefined ? x.max : 99,
  unit: x.unit || '', description: x.d || '',
});
const group = (id, name, selection, options, d = '') => ({ id, name, selection, description: d, options });
const rule = (id, trigger, suggest, message) => ({ id, trigger, suggest, message });
const onItem = (ref) => ({ kind: 'item', ref });
const onOpt = (group, ref) => ({ kind: 'option', group, ref });

// ---------- shared option groups ----------
const localization = () => group('localization', 'Localization', 'multiple', [
  opt('languages', 'Languages', 'quantity', 'percent', 15, { def: 1, min: 1, max: 30, free: 1, unit: 'language', d: 'Each language after the first adds layout checks for text length and formatting.' }),
  opt('rtl', 'RTL support (e.g. Arabic, Hebrew, Urdu)', 'toggle', 'percent', 20, { d: 'Mirrored layouts for right-to-left scripts.' }),
], 'How many languages the design must support.');
const theming = () => group('theming', 'Theming', 'single', [
  opt('light', 'Light only', 'toggle', 'none', 0, { def: true }),
  opt('dark', 'Dark only', 'toggle', 'none', 0),
  opt('both', 'Light + Dark', 'toggle', 'percent', 25, { d: 'A second full colour theme for every screen.' }),
], 'Colour themes to design.');
const quality = () => group('quality', 'Quality & handoff', 'multiple', [
  opt('a11y', 'Accessibility (WCAG 2.1 AA)', 'toggle', 'percent', 8, { d: 'Contrast, focus states, touch targets and annotations for assistive tech.' }),
  opt('handoff', 'Developer handoff & specs', 'toggle', 'percent', 5, { def: true, d: 'Annotated specs, redlines and asset export for developers.' }),
  opt('qa', 'Design QA rounds', 'quantity', 'fixed', 6, { def: 1, max: 10, unit: 'round', d: 'Reviewing the built product against the design.' }),
], 'Non-functional scope that affects design effort.');

// =====================================================================
// WEBSITE
// =====================================================================
const website = {
  name: 'Website',
  description: 'Marketing, corporate, campaign and e-commerce websites',
  icon: 'globe', order: 1, active: true,
  labels: { category: 'Page group', item: 'Page', items: 'Pages', sub: 'Section', subs: 'Sections' },
  categories: [
    { id: 'global', name: 'Global elements' },
    { id: 'core', name: 'Core pages' },
    { id: 'content', name: 'Content & marketing' },
    { id: 'commerce', name: 'Commerce' },
    { id: 'utility', name: 'Utility & legal' },
  ],
  subItems: [
    sub('primary-nav', 'Primary navigation', 2.5, { inc: 'Desktop navigation with hover and active states' }),
    sub('mega-menu', 'Mega menu', 3),
    sub('search-overlay', 'Search overlay', 2),
    sub('announcement-bar', 'Announcement bar', 0.5),
    sub('hero', 'Hero', 4, { inc: 'Headline, supporting copy, primary and secondary CTA, visual composition', exc: 'Custom illustration, 3D or video production' }),
    sub('page-header', 'Page header (inner pages)', 1.5),
    sub('logo-strip', 'Logo strip / social proof', 1),
    sub('features-grid', 'Features / services grid', 3),
    sub('feature-detail', 'Feature detail (alternating rows)', 3),
    sub('stats', 'Stats / numbers', 1.5),
    sub('testimonials', 'Testimonials', 2),
    sub('case-grid', 'Case studies / portfolio grid', 3),
    sub('pricing-table', 'Pricing table', 4, { inc: 'Plan comparison with monthly/annual toggle' }),
    sub('faq', 'FAQ', 2),
    sub('cta-banner', 'CTA banner', 1),
    sub('team-grid', 'Team grid', 2),
    sub('process', 'Process / timeline', 2.5),
    sub('article-cards', 'Article cards', 2),
    sub('article-body', 'Article body template', 3, { inc: 'Typography for headings, quotes, images, embeds and lists' }),
    sub('contact-form', 'Contact form', 3, { inc: 'Field validation, error and success states' }),
    sub('map', 'Map / locations', 1.5),
    sub('newsletter', 'Newsletter signup', 1),
    sub('gallery', 'Gallery / media', 2),
    sub('video', 'Video section', 1.5),
    sub('rich-text', 'Rich text block', 1),
    sub('filters', 'Filters & search bar', 3),
    sub('product-grid', 'Product grid', 4),
    sub('buy-box', 'Product gallery & buy box', 5, { inc: 'Image gallery, variant pickers, price, add to cart, stock states' }),
    sub('product-info', 'Product information tabs', 2),
    sub('reviews', 'Reviews & ratings', 2.5),
    sub('job-list', 'Job listings', 2),
  ],
  items: [
    // Global
    item('header', 'global', 'Header & navigation', 0, { subs: ['primary-nav'], d: 'Site-wide header, designed once and reused on every page.', exc: 'Mobile navigation drawer (covered by Mobile responsive)' }),
    item('footer', 'global', 'Footer', 2.5, { d: 'Site-wide footer with links, contact details and legal links.' }),
    item('cookie', 'global', 'Cookie consent banner', 1),
    // Core
    item('home', 'core', 'Home', 0, { subs: ['hero', 'logo-strip', 'features-grid', 'feature-detail', 'stats', 'testimonials', 'cta-banner'], d: 'The main landing page of the site.' }),
    item('about', 'core', 'About us', 0, { subs: ['page-header', 'rich-text', 'process', 'team-grid', 'stats', 'cta-banner'] }),
    item('services', 'core', 'Services / solutions', 0, { subs: ['page-header', 'features-grid', 'feature-detail', 'testimonials', 'cta-banner'] }),
    item('service-detail', 'core', 'Service detail', 0, { subs: ['page-header', 'feature-detail', 'process', 'faq', 'cta-banner'], multi: true, d: 'Template for an individual service page. Add a quantity when several services need their own layout.' }),
    item('contact', 'core', 'Contact', 0, { subs: ['page-header', 'contact-form', 'map'] }),
    // Content
    item('pricing', 'content', 'Pricing', 0, { subs: ['page-header', 'pricing-table', 'faq', 'cta-banner'] }),
    item('landing', 'content', 'Campaign landing page', 0, { subs: ['hero', 'features-grid', 'testimonials', 'faq', 'cta-banner'], multi: true }),
    item('blog-list', 'content', 'Blog listing', 0, { subs: ['page-header', 'filters', 'article-cards', 'newsletter'] }),
    item('blog-article', 'content', 'Blog article', 0, { subs: ['article-body', 'article-cards', 'newsletter'], d: 'One reusable article template.' }),
    item('case-list', 'content', 'Case studies listing', 0, { subs: ['page-header', 'filters', 'case-grid', 'cta-banner'] }),
    item('case-detail', 'content', 'Case study detail', 0, { subs: ['page-header', 'rich-text', 'gallery', 'stats', 'testimonials', 'cta-banner'], d: 'One reusable case study template.' }),
    item('careers', 'content', 'Careers', 0, { subs: ['page-header', 'rich-text', 'features-grid', 'job-list', 'cta-banner'] }),
    // Commerce
    item('plp', 'commerce', 'Product listing', 0, { subs: ['page-header', 'filters', 'product-grid'], d: 'Category or collection page with filtering.' }),
    item('pdp', 'commerce', 'Product detail', 0, { subs: ['buy-box', 'product-info', 'reviews', 'product-grid'] }),
    item('cart', 'commerce', 'Cart', 6, { inc: 'Line items, quantity edits, promo code, empty state' }),
    item('checkout', 'commerce', 'Checkout', 10, { inc: 'Address, shipping, payment and review steps with error states', exc: 'Payment provider hosted pages' }),
    item('order-confirmation', 'commerce', 'Order confirmation', 2),
    item('account', 'commerce', 'Customer account', 6, { inc: 'Sign in, register, forgot password, order history' }),
    // Utility
    item('search-results', 'utility', 'Search results', 4, { inc: 'Results list, no-results state' }),
    item('not-found', 'utility', '404 / error page', 1.5),
    item('legal', 'utility', 'Legal page (privacy, terms)', 1.5, { multi: true, d: 'Text-only template for privacy, terms and similar pages.' }),
    item('thank-you', 'utility', 'Thank-you page', 1),
  ],
  optionGroups: [
    group('responsive', 'Responsiveness', 'multiple', [
      opt('desktop', 'Desktop', 'toggle', 'none', 0, { def: true, locked: true, d: 'Primary design. Page and section hours are desktop hours.' }),
      opt('mobile', 'Mobile responsive', 'toggle', 'percent', 40, { def: true, d: 'Adapting every page and section to phone widths.' }),
      opt('tablet', 'Tablet responsive', 'toggle', 'percent', 25, { d: 'Adapting every page and section to tablet widths.' }),
    ], 'Screen sizes to design for.'),
    localization(),
    theming(),
    group('deliverables', 'Other deliverables', 'multiple', [
      opt('design-system', 'Design system / UI kit', 'toggle', 'percent', 15, { d: 'Reusable components, tokens and documentation.' }),
      opt('prototype', 'Interactive prototype', 'toggle', 'percent', 10, { d: 'Clickable prototype for key journeys.' }),
      opt('illustrations', 'Custom illustrations', 'quantity', 'fixed', 6, { unit: 'illustration' }),
      opt('animations', 'Custom animations', 'quantity', 'fixed', 4, { unit: 'animation', d: 'Micro-interactions or Lottie animations.' }),
      opt('icons', 'Custom icons', 'quantity', 'fixed', 0.75, { unit: 'icon' }),
    ], 'Extra design work beyond pages and sections.'),
    quality(),
  ],
  starterPacks: [
    { id: 'corporate', name: 'Corporate website', description: 'Typical company site', items: ['header', 'footer', 'cookie', 'home', 'about', 'services', 'service-detail', 'contact', 'not-found', 'legal'] },
    { id: 'campaign', name: 'Campaign landing page', description: 'Single campaign page', items: ['header', 'footer', 'landing', 'thank-you'] },
    { id: 'ecommerce', name: 'E-commerce essentials', description: 'Core shopping journey', items: ['header', 'footer', 'home', 'plp', 'pdp', 'cart', 'checkout', 'order-confirmation', 'account', 'search-results'] },
    { id: 'content-hub', name: 'Blog / content hub', description: 'Editorial content', items: ['blog-list', 'blog-article', 'search-results'] },
  ],
  gapRules: [
    rule('w-home-header', onItem('home'), onItem('header'), 'Every site needs a header and navigation.'),
    rule('w-home-footer', onItem('home'), onItem('footer'), 'Every site needs a footer.'),
    rule('w-home-404', onItem('home'), onItem('not-found'), 'Broken links need a designed error page.'),
    rule('w-cart-checkout', onItem('cart'), onItem('checkout'), 'A cart usually leads to a checkout flow.'),
    rule('w-checkout-confirm', onItem('checkout'), onItem('order-confirmation'), 'Checkout needs a confirmation page.'),
    rule('w-plp-pdp', onItem('plp'), onItem('pdp'), 'Product listings link to product detail pages.'),
    rule('w-blog-article', onItem('blog-list'), onItem('blog-article'), 'A blog listing needs an article template.'),
    rule('w-case-detail', onItem('case-list'), onItem('case-detail'), 'A case study listing needs a detail template.'),
    rule('w-contact-thanks', onItem('contact'), onItem('thank-you'), 'Form submissions need a confirmation page.'),
    rule('w-lang-rtl', onOpt('localization', 'languages'), onOpt('localization', 'rtl'), 'Supporting Arabic, Hebrew or Urdu? Right-to-left layouts need extra design time.'),
  ],
};

// =====================================================================
// MOBILE APP
// =====================================================================
const mobile = {
  name: 'Mobile application',
  description: 'Native or cross-platform apps for iOS and Android',
  icon: 'smartphone', order: 2, active: true,
  labels: { category: 'Module', item: 'Feature', items: 'Features', sub: 'Screen', subs: 'Screens' },
  categories: [
    { id: 'onboarding', name: 'Onboarding' },
    { id: 'auth', name: 'Authentication' },
    { id: 'home', name: 'Home & discovery' },
    { id: 'account', name: 'Account & profile' },
    { id: 'notifications', name: 'Notifications' },
    { id: 'commerce', name: 'Commerce & payments' },
    { id: 'communication', name: 'Communication' },
    { id: 'system', name: 'Settings & system' },
  ],
  subItems: [
    sub('home-header', 'Header & greeting', 1.5),
    sub('quick-actions', 'Quick actions', 2),
    sub('content-feed', 'Content cards / feed', 4),
    sub('promo-banner', 'Promotional banner', 1.5),
    sub('stories', 'Stories / highlights', 2.5),
  ],
  items: [
    item('splash', 'onboarding', 'Splash screen', 1.5),
    item('carousel', 'onboarding', 'Onboarding carousel', 4, { inc: 'Up to 4 intro screens with skip and progress' }),
    item('permissions', 'onboarding', 'Permission requests', 2, { inc: 'Pre-permission screens for notifications and location' }),
    item('login', 'auth', 'Login', 6, { d: 'Sign in with email or phone and password.', inc: 'Email/phone + password, validation and error states, show/hide password', exc: 'Social login and biometric login (separate features)' }),
    item('signup', 'auth', 'Sign up', 5, { inc: 'Registration form, terms consent, validation and error states' }),
    item('forgot', 'auth', 'Forgot / reset password', 3, { inc: 'Request, email sent and new password screens' }),
    item('otp', 'auth', 'OTP verification', 3, { inc: 'Code entry, resend timer, error states' }),
    item('social', 'auth', 'Social login (Google, Apple)', 2),
    item('biometric', 'auth', 'Biometric login', 1.5),
    item('home-dashboard', 'home', 'Home dashboard', 0, { subs: ['home-header', 'quick-actions', 'content-feed', 'promo-banner'], d: 'The main screen after sign-in.' }),
    item('search', 'home', 'Search', 5, { inc: 'Recent searches, results, no-results state' }),
    item('filters', 'home', 'Filters & sorting', 4),
    item('category-list', 'home', 'Category listing', 4),
    item('item-detail', 'home', 'Item detail', 6),
    item('profile', 'account', 'Profile view / edit', 5),
    item('account-settings', 'account', 'Account settings', 4),
    item('change-password', 'account', 'Change password', 1.5),
    item('delete-account', 'account', 'Delete account flow', 2, { inc: 'Confirmation, reason picker and success state' }),
    item('notification-list', 'notifications', 'Notification list', 4, { inc: 'Read/unread states, empty state' }),
    item('push-templates', 'notifications', 'Push notification templates', 2),
    item('cart', 'commerce', 'Cart', 5),
    item('checkout', 'commerce', 'Checkout', 8, { inc: 'Address, delivery, payment and review steps', exc: 'Payment provider native sheets (Apple Pay, Google Pay)' }),
    item('payment-methods', 'commerce', 'Payment methods', 4),
    item('order-history', 'commerce', 'Order history', 4),
    item('order-detail', 'commerce', 'Order detail & tracking', 5),
    item('chat', 'communication', 'In-app chat', 10, { inc: 'Conversation list, chat thread, attachments, typing and delivery states' }),
    item('help', 'communication', 'Help center & support', 4),
    item('feedback', 'communication', 'Feedback & ratings', 2.5),
    item('app-settings', 'system', 'App settings', 4),
    item('language-selector', 'system', 'Language selector', 1),
    item('system-states', 'system', 'Empty, error & offline states', 4, { d: 'A shared set of system states used across the app.' }),
    item('force-update', 'system', 'Force update / maintenance', 1.5),
    item('about-legal', 'system', 'About & legal screens', 1.5),
  ],
  optionGroups: [
    group('platforms', 'Platforms', 'multiple', [
      opt('primary', 'Primary platform (iOS or Android)', 'toggle', 'none', 0, { def: true, locked: true, d: 'Feature hours are for one platform.' }),
      opt('second-platform', 'Second platform adaptation', 'toggle', 'percent', 30, { d: 'Adapting to the other platform\'s patterns and components.' }),
      opt('tablet', 'Tablet layouts', 'toggle', 'percent', 35),
    ], 'Platforms and form factors to design for.'),
    localization(),
    theming(),
    group('deliverables', 'Other deliverables', 'multiple', [
      opt('design-system', 'Design system / UI kit', 'toggle', 'percent', 15),
      opt('prototype', 'Interactive prototype', 'toggle', 'percent', 10),
      opt('app-icon', 'App icon & splash artwork', 'toggle', 'fixed', 8),
      opt('store-screens', 'App store screenshot sets', 'quantity', 'fixed', 6, { unit: 'set' }),
      opt('illustrations', 'Custom illustrations', 'quantity', 'fixed', 6, { unit: 'illustration' }),
      opt('animations', 'Custom animations (Lottie)', 'quantity', 'fixed', 4, { unit: 'animation' }),
    ], 'Extra design work beyond features and screens.'),
    quality(),
  ],
  starterPacks: [
    { id: 'standard-auth', name: 'Standard auth', description: 'Login, sign up, reset, OTP', items: ['login', 'signup', 'forgot', 'otp'] },
    { id: 'essentials', name: 'App essentials', description: 'Screens almost every app needs', items: ['splash', 'carousel', 'home-dashboard', 'profile', 'account-settings', 'notification-list', 'app-settings', 'system-states'] },
    { id: 'commerce', name: 'Commerce', description: 'Browse, buy and track', items: ['search', 'filters', 'category-list', 'item-detail', 'cart', 'checkout', 'payment-methods', 'order-history', 'order-detail'] },
  ],
  gapRules: [
    rule('m-login-forgot', onItem('login'), onItem('forgot'), 'People who sign in will need to reset a forgotten password.'),
    rule('m-signup-login', onItem('signup'), onItem('login'), 'Sign up usually comes with a login screen.'),
    rule('m-signup-otp', onItem('signup'), onItem('otp'), 'Sign-ups often verify an email or phone number.'),
    rule('m-signup-delete', onItem('signup'), onItem('delete-account'), 'The App Store and Google Play require apps with sign-up to offer account deletion in the app.'),
    rule('m-profile-settings', onItem('profile'), onItem('account-settings'), 'Profiles usually link to account settings.'),
    rule('m-cart-checkout', onItem('cart'), onItem('checkout'), 'A cart usually leads to a checkout flow.'),
    rule('m-checkout-payment', onItem('checkout'), onItem('payment-methods'), 'Checkout needs a way to add and choose payment methods.'),
    rule('m-checkout-orders', onItem('checkout'), onItem('order-detail'), 'Customers expect to track an order after checkout.'),
    rule('m-notif-push', onItem('notification-list'), onItem('push-templates'), 'In-app notifications usually have matching push notifications.'),
    rule('m-home-states', onItem('home-dashboard'), onItem('system-states'), 'Every data screen needs empty, error and offline states.'),
    rule('m-lang-selector', onOpt('localization', 'languages'), onItem('language-selector'), 'Multi-language apps need a language selector.'),
    rule('m-lang-rtl', onOpt('localization', 'languages'), onOpt('localization', 'rtl'), 'Supporting Arabic, Hebrew or Urdu? Right-to-left layouts need extra design time.'),
  ],
};

// =====================================================================
// WEB APPLICATION
// =====================================================================
const webapp = {
  name: 'Web application',
  description: 'SaaS products, admin panels and dashboards',
  icon: 'layout', order: 3, active: true,
  labels: { category: 'Module', item: 'Feature', items: 'Features', sub: 'View', subs: 'Views' },
  categories: [
    { id: 'auth', name: 'Authentication & access' },
    { id: 'onboarding', name: 'Onboarding' },
    { id: 'data', name: 'Dashboard & data' },
    { id: 'collab', name: 'Collaboration' },
    { id: 'users', name: 'Users & teams' },
    { id: 'billing', name: 'Billing' },
    { id: 'system', name: 'System' },
  ],
  subItems: [
    sub('kpi-cards', 'KPI cards', 3),
    sub('charts', 'Charts', 4),
    sub('recent-activity', 'Recent activity', 2),
    sub('dash-actions', 'Quick actions', 1.5),
    sub('date-filters', 'Filters & date range', 2.5),
    sub('widgets', 'Widget customization', 4),
  ],
  items: [
    item('login', 'auth', 'Login', 5, { inc: 'Email + password, validation and error states', exc: 'SSO (separate feature)' }),
    item('signup', 'auth', 'Sign up', 5),
    item('forgot', 'auth', 'Forgot / reset password', 3),
    item('2fa', 'auth', 'Two-factor authentication', 3),
    item('sso', 'auth', 'SSO login', 2),
    item('invite', 'auth', 'Invite & accept invitation', 3),
    item('onboarding-wizard', 'onboarding', 'Onboarding wizard', 6, { inc: 'Up to 4 setup steps with progress' }),
    item('first-run', 'onboarding', 'Empty states & first run', 3),
    item('dashboard', 'data', 'Main dashboard', 0, { subs: ['kpi-cards', 'charts', 'recent-activity', 'dash-actions'], d: 'The overview screen users land on.' }),
    item('reports', 'data', 'Reports & analytics', 8),
    item('data-table', 'data', 'Data table with filters', 6, { inc: 'Sorting, filtering, pagination, bulk actions, empty state', multi: true }),
    item('detail-view', 'data', 'Detail view', 5, { multi: true }),
    item('form', 'data', 'Create / edit form', 5, { inc: 'Validation, error and success states', multi: true }),
    item('comments', 'collab', 'Comments & mentions', 4),
    item('activity-log', 'collab', 'Activity log / audit trail', 3),
    item('notifications', 'collab', 'Notifications center', 4),
    item('user-management', 'users', 'User management', 6, { inc: 'User list, invite, deactivate' }),
    item('roles', 'users', 'Roles & permissions', 5),
    item('workspace', 'users', 'Team / workspace settings', 4),
    item('profile', 'users', 'Profile & account settings', 4),
    item('plans', 'billing', 'Plans & pricing', 4),
    item('payment', 'billing', 'Checkout & payment', 5),
    item('invoices', 'billing', 'Billing history & invoices', 3),
    item('navigation', 'system', 'Global navigation (sidebar + top bar)', 6, { d: 'The app shell used on every screen.' }),
    item('command-palette', 'system', 'Global search / command palette', 4),
    item('settings', 'system', 'App preferences', 4),
    item('integrations', 'system', 'Integrations & API keys', 4),
    item('help', 'system', 'Help & support', 3),
    item('error-pages', 'system', 'Error pages (404 / 500)', 2),
  ],
  optionGroups: [
    group('responsive', 'Responsiveness', 'multiple', [
      opt('desktop', 'Desktop', 'toggle', 'none', 0, { def: true, locked: true, d: 'Primary design. Feature hours are desktop hours.' }),
      opt('mobile', 'Mobile responsive', 'toggle', 'percent', 45, { d: 'Dense app screens take more work to adapt than marketing pages.' }),
      opt('tablet', 'Tablet responsive', 'toggle', 'percent', 25),
    ], 'Screen sizes to design for.'),
    localization(),
    theming(),
    group('deliverables', 'Other deliverables', 'multiple', [
      opt('design-system', 'Design system / UI kit', 'toggle', 'percent', 15),
      opt('prototype', 'Interactive prototype', 'toggle', 'percent', 10),
      opt('email-templates', 'Transactional email templates', 'quantity', 'fixed', 3, { unit: 'template' }),
      opt('illustrations', 'Custom illustrations', 'quantity', 'fixed', 6, { unit: 'illustration' }),
      opt('animations', 'Custom animations', 'quantity', 'fixed', 4, { unit: 'animation' }),
    ], 'Extra design work beyond features and views.'),
    quality(),
  ],
  starterPacks: [
    { id: 'saas', name: 'SaaS foundation', description: 'App shell, auth and settings', items: ['navigation', 'login', 'signup', 'forgot', 'dashboard', 'profile', 'notifications', 'settings', 'error-pages'] },
    { id: 'admin', name: 'Admin panel', description: 'Manage records and users', items: ['navigation', 'login', 'dashboard', 'data-table', 'detail-view', 'form', 'user-management', 'roles', 'activity-log'] },
    { id: 'billing', name: 'Billing', description: 'Plans, payment and invoices', items: ['plans', 'payment', 'invoices'] },
  ],
  gapRules: [
    rule('a-login-forgot', onItem('login'), onItem('forgot'), 'People who sign in will need to reset a forgotten password.'),
    rule('a-signup-onboarding', onItem('signup'), onItem('onboarding-wizard'), 'New sign-ups usually go through a setup flow.'),
    rule('a-table-detail', onItem('data-table'), onItem('detail-view'), 'Table rows usually open a detail view.'),
    rule('a-table-form', onItem('data-table'), onItem('form'), 'Records in a table need a create / edit form.'),
    rule('a-users-roles', onItem('user-management'), onItem('roles'), 'Managing users usually includes roles and permissions.'),
    rule('a-dash-empty', onItem('dashboard'), onItem('first-run'), 'Dashboards need empty states for new accounts.'),
    rule('a-dash-nav', onItem('dashboard'), onItem('navigation'), 'Every app screen sits inside the global navigation.'),
    rule('a-plans-payment', onItem('plans'), onItem('payment'), 'Choosing a plan leads to checkout and payment.'),
    rule('a-lang-rtl', onOpt('localization', 'languages'), onOpt('localization', 'rtl'), 'Supporting Arabic, Hebrew or Urdu? Right-to-left layouts need extra design time.'),
  ],
};

// =====================================================================
// BRANDING (inactive example of an extra service)
// =====================================================================
const branding = {
  name: 'Branding & logo',
  description: 'Logo design, visual identity and brand guidelines',
  icon: 'pen', order: 4, active: false,
  labels: { category: 'Area', item: 'Deliverable', items: 'Deliverables', sub: 'Stage', subs: 'Stages' },
  categories: [
    { id: 'strategy', name: 'Strategy' },
    { id: 'identity', name: 'Identity' },
    { id: 'guidelines', name: 'Guidelines' },
  ],
  subItems: [
    sub('concepts', 'Concept exploration', 10, { inc: '3 initial logo concepts' }),
    sub('refinement', 'Refinement', 6),
    sub('variations', 'Logo variations (horizontal, stacked, icon)', 4),
  ],
  items: [
    item('workshop', 'strategy', 'Brand discovery workshop', 6),
    item('research', 'strategy', 'Competitor & moodboard research', 5),
    item('logo', 'identity', 'Logo design', 0, { subs: ['concepts', 'refinement', 'variations'] }),
    item('colour', 'identity', 'Colour palette', 3),
    item('type', 'identity', 'Typography system', 3),
    item('iconography', 'identity', 'Iconography style', 4),
    item('guidelines', 'guidelines', 'Brand guidelines document', 12),
  ],
  optionGroups: [
    group('concepts', 'Concepts', 'multiple', [
      opt('extra-concepts', 'Additional logo concepts', 'quantity', 'fixed', 4, { unit: 'concept' }),
    ], 'Logo design includes 3 concepts.'),
    group('applications', 'Brand applications', 'multiple', [
      opt('cards', 'Business cards', 'toggle', 'fixed', 3),
      opt('social', 'Social media kit', 'toggle', 'fixed', 6),
      opt('deck', 'Presentation template', 'toggle', 'fixed', 8),
      opt('signature', 'Email signature', 'toggle', 'fixed', 1.5),
    ]),
  ],
  starterPacks: [
    { id: 'identity', name: 'Visual identity', description: 'Logo, colour, type, guidelines', items: ['logo', 'colour', 'type', 'guidelines'] },
  ],
  gapRules: [
    rule('b-logo-guidelines', onItem('logo'), onItem('guidelines'), 'A new logo usually ships with usage guidelines.'),
  ],
};

const settings = {
  agencyName: '',
  bufferPercent: 10,
  complexity: [
    { id: 'simple', name: 'Simple', multiplier: 0.75, description: 'Standard patterns, few states' },
    { id: 'standard', name: 'Standard', multiplier: 1, description: 'Typical effort' },
    { id: 'complex', name: 'Complex', multiplier: 1.5, description: 'Custom interactions, many states or heavy data' },
  ],
  overhead: [
    { id: 'requirements', name: 'Requirement breakdown & analysis', rule: 'fixed', value: 6, enabled: true, description: 'Brief review, feature breakdown and questions for the client' },
    { id: 'setup', name: 'Project setup', rule: 'fixed', value: 3, enabled: true, description: 'Files, styles, tokens and handoff structure' },
    { id: 'meetings', name: 'Meetings & presentations', rule: 'percent', value: 8, enabled: true, description: 'Kick-off, reviews and design presentations' },
    { id: 'feedback', name: 'Feedback & iterations', rule: 'percent', value: 15, enabled: true, description: 'Revision rounds after client feedback' },
  ],
  phases: ['Phase 1 (MVP)', 'Phase 2', 'Phase 3'],
  defaultAssumptions: [
    'The client provides final copy, images and brand assets before design starts',
    'Feedback is consolidated and sent by one point of contact within 3 working days',
    'Up to two revision rounds per deliverable are covered by the feedback allowance',
    'The estimate covers UX/UI design only; development and QA are quoted separately',
  ],
  defaultExclusions: [
    'Copywriting and content creation',
    'Stock photography and font licence fees',
    'Development, testing and deployment',
  ],
};

const docs = {
  'services/website': website,
  'services/mobile-app': mobile,
  'services/web-app': webapp,
  'services/branding': branding,
  'config/settings': settings,
};

// sanity checks: referenced ids exist
for (const [p, s] of Object.entries(docs)) {
  if (!p.startsWith('services/')) continue;
  const items = new Set(s.items.map((i) => i.id));
  const subs = new Set(s.subItems.map((x) => x.id));
  const cats = new Set(s.categories.map((c) => c.id));
  const groups = Object.fromEntries(s.optionGroups.map((g) => [g.id, new Set(g.options.map((o) => o.id))]));
  const fail = (m) => { throw new Error(`${p}: ${m}`); };
  if (items.size !== s.items.length) fail('duplicate item id');
  if (subs.size !== s.subItems.length) fail('duplicate sub id');
  s.items.forEach((i) => { if (!cats.has(i.categoryId)) fail(`item ${i.id} bad category`); i.defaultSubs.forEach((x) => { if (!subs.has(x)) fail(`item ${i.id} bad sub ${x}`); }); });
  s.starterPacks.forEach((k) => k.items.forEach((x) => { if (!items.has(x)) fail(`pack ${k.id} bad item ${x}`); }));
  const chk = (r) => (r.kind === 'item' ? items.has(r.ref) : !!(groups[r.group] && groups[r.group].has(r.ref)));
  s.gapRules.forEach((r) => { if (!chk(r.trigger) || !chk(r.suggest)) fail(`rule ${r.id} bad ref`); });
  const size = JSON.stringify(s).length;
  console.log(p, 'items', s.items.length, 'subs', s.subItems.length, 'bytes', size);
}
fs.writeFileSync(path.join(__dirname, 'seed.json'), JSON.stringify(docs, null, 1));
console.log('wrote seed.json');
