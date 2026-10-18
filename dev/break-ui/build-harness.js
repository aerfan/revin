// Builds dev/break-ui/break-ui.html: the real built app + the mock data store + a dev-only
// "Demo / Worst case / Empty / One / 1,000 rows" switch. The switch swaps the store's seed
// (the data boundary) and keeps the choice in the URL (?data=worst). Never published.
const fs = require('fs');
const path = require('path');
const { DATASETS, NOW } = require('./fixtures');

const ROOT = path.join(__dirname, '..', '..');
const page = fs.readFileSync(path.join(ROOT, 'dist', 'design-hours-estimator.html'), 'utf8');
const mock = fs.readFileSync(path.join(ROOT, 'test', 'mock-claude.js'), 'utf8');

// 1,000 rows are generated in the browser from one template instead of being inlined.
const huge = DATASETS.huge;
const bulkKeys = Object.keys(huge.seed).filter((k) => k.startsWith('estimates/bulk-'));
const template = huge.seed[bulkKeys[0]];
const hugeSeed = Object.fromEntries(Object.entries(huge.seed).filter(([k]) => !k.startsWith('estimates/bulk-')));
const embedded = {
  backup: DATASETS.backup, demo: DATASETS.demo, worst: DATASETS.worst, empty: DATASETS.empty, one: DATASETS.one,
  huge: { seed: hugeSeed, me: {}, people: {}, bulk: { count: bulkKeys.length, template } },
};
const json = JSON.stringify(embedded).replace(/</g, '\\u003c');

const harness = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<style>:root{color-scheme:light;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom)}body{margin:0;font:14px system-ui}img{max-width:100%}[hidden]{display:none!important}</style>
</head><body>
<script>
/* ---- dev-only data switch (break-ui). Not part of the app. ---- */
(function () {
  var DATA = ${json};
  var NOW = ${NOW};
  var LABELS = { backup: 'Claude Backup', demo: 'Demo', worst: 'Worst case', empty: 'Empty', one: 'One', huge: '1,000 rows' };
  var params = new URLSearchParams(location.search);
  var sel = DATA[params.get('data')] ? params.get('data') : (DATA.backup ? 'backup' : 'demo');
  var d = DATA[sel];
  var storageKey = 'dhe_saved_store_' + sel;
  var stored = null;
  try { stored = JSON.parse(localStorage.getItem(storageKey)); } catch (e) {}
  var seed = stored || d.seed;
  if (d.bulk) {
    var statuses = ['draft', 'review', 'sent', 'won', 'lost'], names = ['Website refresh', 'Campaign landing page', 'Customer portal', 'Mobile banking app', 'Design system audit'];
    var clients = ['Acme', 'Globex', 'Initech', 'Umbrella', 'Hooli', 'Stark Industries', 'Wayne Enterprises', 'Soylent', 'Tyrell', 'Cyberdyne'];
    seed = Object.assign({}, seed);
    for (var i = 0; i < d.bulk.count; i++) {
      var e = JSON.parse(JSON.stringify(d.bulk.template));
      e.name = names[i % 5] + ' #' + (1000 - i); e.client = clients[i % 10]; e.status = statuses[i % 5];
      e.totalHours = 8 + (i * 37) % 900; e.updatedAt = NOW - i * 3 * 3600000; e.createdAt = e.updatedAt - 86400000;
      seed['estimates/bulk-' + ('000' + i).slice(-4)] = e;
    }
  }
  // Pin the clock to the fixtures' "now" (it keeps ticking), so relative times read the same every time.
  var realNow = Date.now.bind(Date), t0 = realNow();
  Date.now = function () { return NOW + (realNow() - t0); };
  var role = params.get('role') === 'estimator' ? 'estimator' : 'admin';
  window.__MOCK__ = { role: role, seed: seed, me: d.me, people: d.people };
  window.__BREAK_UI__ = { sel: sel, labels: LABELS, storageKey: storageKey };
})();
</script>
<script>
${mock.replace('var store = new Map();', 'var store = (window.__MOCK_STORE__ = new Map());')}
</script>
${page}
<style>
  .dev-data-switch { position: fixed; z-index: 2147483000; left: 50%; transform: translateX(-50%); bottom: calc(10px + env(safe-area-inset-bottom, 0px)); display: flex; align-items: center; gap: 6px; padding: 4px; border-radius: 999px; background: #e7e7e9; box-shadow: 0 2px 10px rgba(0,0,0,.18); font: 500 12px/1 system-ui, -apple-system, Segoe UI, sans-serif; color: #333; max-width: calc(100vw - 16px); overflow-x: auto; }
  .dev-data-switch button { all: unset; cursor: pointer; padding: 7px 11px; border-radius: 999px; white-space: nowrap; color: #444; }
  .dev-data-switch button[aria-pressed="true"] { background: #fff; color: #111; box-shadow: 0 1px 2px rgba(0,0,0,.18); }
  .dev-data-switch button:focus-visible { outline: 2px solid #4b7bec; }
  .dev-data-switch .dev-tag { padding: 0 6px 0 10px; color: #777; font-weight: 600; letter-spacing: .04em; text-transform: uppercase; font-size: 10px; }
  .dev-data-switch.min button:not(.dev-min) { display: none; }
</style>
<script>
(function () {
  var cfg = window.__BREAK_UI__;
  var bar = document.createElement('div');
  bar.className = 'dev-data-switch'; bar.setAttribute('role', 'group'); bar.setAttribute('aria-label', 'Dev data set (not part of the app)');
  var tag = document.createElement('span'); tag.className = 'dev-tag'; tag.textContent = 'Dev data'; bar.appendChild(tag);
  Object.keys(cfg.labels).forEach(function (k) {
    var b = document.createElement('button'); b.type = 'button'; b.textContent = cfg.labels[k];
    b.setAttribute('aria-pressed', k === cfg.sel ? 'true' : 'false');
    b.onclick = function () { var p = new URLSearchParams(location.search); p.set('data', k); location.search = p.toString(); };
    bar.appendChild(b);
  });
  var rst = document.createElement('button'); rst.type = 'button'; rst.title = 'Reset this dataset to default seed'; rst.textContent = '↺ Reset';
  rst.onclick = function () {
    if (confirm('Reset "' + cfg.labels[cfg.sel] + '" data to default? Any local edits will be cleared.')) {
      try { localStorage.removeItem(cfg.storageKey); } catch (e) {}
      location.reload();
    }
  };
  bar.appendChild(rst);
  var min = document.createElement('button'); min.type = 'button'; min.className = 'dev-min'; min.textContent = '–'; min.title = 'Minimise';
  min.onclick = function () { bar.classList.toggle('min'); min.textContent = bar.classList.contains('min') ? cfg.labels[cfg.sel] + ' ▴' : '–'; };
  bar.appendChild(min);
  document.body.appendChild(bar);

  if (window.__writes) {
    var saveTimer;
    function syncToStorage() {
      if (!window.__MOCK_STORE__) return;
      try {
        var obj = {};
        window.__MOCK_STORE__.forEach(function(v, k) { obj[k] = v; });
        localStorage.setItem(cfg.storageKey, JSON.stringify(obj));
      } catch (e) {}
    }
    var checkLen = window.__writes.length;
    setInterval(function() {
      if (window.__writes && window.__writes.length !== checkLen) {
        checkLen = window.__writes.length;
        clearTimeout(saveTimer);
        saveTimer = setTimeout(syncToStorage, 300);
      }
    }, 200);
  }
})();
</script>
</body></html>`;

const out = path.join(__dirname, 'break-ui.html');
fs.writeFileSync(out, harness);
console.log('wrote', path.relative(ROOT, out), (harness.length / 1024).toFixed(0) + ' KB');
