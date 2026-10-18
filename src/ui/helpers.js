var STEPS = [
    { id: 'service', n: 1, name: 'Service' }, { id: 'scope', n: 2, name: 'Scope' },
    { id: 'build', n: 3, name: 'Build' }, { id: 'review', n: 4, name: 'Review' },
  ];
  var FALLBACK_SETTINGS = { agencyName: '', bufferPercent: 10, complexity: E.DEFAULT_COMPLEXITY, overhead: [], phases: ['Phase 1'], defaultAssumptions: [], defaultExclusions: [] };
  var RULES = [
    { value: 'none', label: 'No extra hours' }, { value: 'percent', label: '% of base design' },
    { value: 'fixed', label: 'Fixed hours' }, { value: 'perItem', label: 'Hours per item' },
  ];
  var VENDOR = window.DHE_VENDOR || null;
  var EXCEL_URLS = VENDOR ? [VENDOR.exceljs] : ['https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js', 'https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js'];

  if (typeof window !== 'undefined') {
    window.RevinTelemetry = Telemetry;
  }
  function clean(o) { var c = JSON.parse(JSON.stringify(o)); delete c.id; return c; }
  function newId(prefix) { return (prefix || 'est') + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7); }
  function uniqueId(base, taken) { var b = E.slug(base), id = b, i = 2; while (taken.indexOf(id) >= 0) id = b + '-' + (i++); return id; }
  function ago(ts) {
    if (!ts) return '';
    var s = (Date.now() - ts) / 1000;
    if (s < 60) return 'Just now';
    if (s < 3600) return Math.floor(s / 60) + ' min ago';
    if (s < 86400) return Math.floor(s / 3600) + ' hr ago';
    if (s < 86400 * 7) { var d = Math.floor(s / 86400); return d + (d === 1 ? ' day ago' : ' days ago'); }
    var dt = new Date(ts);
    return dt.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: dt.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined });
  }
  function today() { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function plural(n, one, many) { return (n === 1 ? one : many); }
  function lower(s) { return String(s || '').toLowerCase(); }
  function loadScript(urls, libName) {
    return new Promise(function (resolve, reject) {
      var i = 0;
      (function next() {
        if (i >= urls.length) { reject(new Error('The ' + (libName || 'library') + ' did not load. Check your connection and try again.')); return; }
        var s = document.createElement('script');
        s.src = urls[i++]; s.async = true;
        s.onload = function () { resolve(); };
        s.onerror = function () { s.remove(); next(); };
        document.head.appendChild(s);
      })();
    });
  }
  var DOCX_URLS = VENDOR ? [VENDOR.docx] : ['https://cdn.jsdelivr.net/npm/docx@8.5.0/build/index.umd.js', 'https://unpkg.com/docx@8.5.0/build/index.umd.js'];
  function loadDocx() { return window.docx ? Promise.resolve(window.docx) : loadScript(DOCX_URLS, 'document (Word)').then(function () { if (!window.docx) throw new Error('The document library did not load. Check your connection and try again.'); return window.docx; }); }
  function loadExcel() { return window.ExcelJS ? Promise.resolve(window.ExcelJS) : loadScript(EXCEL_URLS, 'spreadsheet (Excel)').then(function () { return window.ExcelJS; }); }
  function useProfiles(user, ids) {
    var key = ids.slice().sort().join(',');
    var st = useState({}), map = st[0], setMap = st[1];
    useEffect(function () {
      if (!user || !ids.length) return;
      var live = true;
      user.profiles(ids).then(function (m) { if (live) setMap(m || {}); }).catch(function () { /* reads never reject */ });
      return function () { live = false; };
    }, [user, key]);
    return map;
  }

  // Display text from data: trimmed, with a fallback when blank (a name of only spaces reads as missing).
  function nm(v, fb) { var t = String(v == null ? '' : v).trim(); return t || fb; }
  function statusOf(id) {
    var k = id || 'draft';
    return E.STATUSES.filter(function (x) { return x.id === k; })[0] || { id: 'other', name: String(k).charAt(0).toUpperCase() + String(k).slice(1) };
  }
  // Initials from whole characters (grapheme clusters), first + last word, ignoring Jr/III suffixes and emoji.
  function firstChar(w) {
    w = w.replace(/^[^\p{L}\p{N}]+/u, '');
    try { var it = new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(w)[Symbol.iterator]().next(); return it.done ? '' : it.value.segment; } catch (e) { return Array.from(w)[0] || ''; }
  }
  function initials(name) {
    var words = String(name || '').trim().split(/\s+/).filter(function (w) { return /[\p{L}\p{N}]/u.test(w); });
    if (words.length > 1 && /^(jr\.?|sr\.?|ii|iii|iv)$/i.test(words[words.length - 1])) words.pop();
    if (!words.length) return '?';
    return (firstChar(words[0]) + (words.length > 1 ? firstChar(words[words.length - 1]) : '')).toUpperCase();
  }
