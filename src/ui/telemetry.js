// ------------------------------------------------------------------ helpers
  var local = {
    get: function (k, d) { try { var v = localStorage.getItem('dhe:' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem('dhe:' + k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } },
  };
  var Telemetry = {
    crumbs: [],
    maxCrumbs: 15,
    crumb: function (cat, msg) {
      try {
        this.crumbs.push({ t: Date.now(), cat: cat, msg: String(msg || '').slice(0, 100) });
        if (this.crumbs.length > this.maxCrumbs) this.crumbs.shift();
      } catch (e) { /* silent */ }
    },
    record: function (err, extra) {
      try {
        var msg = String((err && (err.message || err.error_description)) || err || 'Unknown error').slice(0, 500);
        var stack = String((err && err.stack) || '').slice(0, 3000);
        var fp = (msg + ':' + (stack.split('\n')[1] || '')).replace(/\s+/g, ' ').slice(0, 120);
        var item = {
          id: 'err-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6),
          fingerprint: fp,
          message: msg,
          stack: stack,
          route: extra && extra.route ? (typeof extra.route === 'string' ? extra.route : JSON.stringify(extra.route)) : null,
          breadcrumbs: this.crumbs.slice(),
          browser: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
          time: Date.now(),
          severity: (extra && extra.severity) || 'error'
        };
        var list = local.get('error_logs', []);
        list.unshift(item);
        if (list.length > 50) list.length = 50;
        local.set('error_logs', list);

        if (extra && extra.api && typeof extra.api.rpc === 'function') {
          extra.api.rpc('log_client_error', {
            p_fingerprint: item.fingerprint,
            p_message: item.message,
            p_stack: item.stack,
            p_route: item.route,
            p_breadcrumbs: item.breadcrumbs,
            p_browser: item.browser,
            p_severity: item.severity
          }).catch(function () { /* fail silently */ });
        }
        return item;
      } catch (e) { return null; }
    },
    getLogs: function () { return local.get('error_logs', []); },
    clearLogs: function () { local.set('error_logs', []); },
    track: function (name, data) {
      try {
        if (typeof window !== 'undefined' && typeof window.va === 'function') {
          window.va('event', { name: name, data: data });
        }
      } catch (e) { /* silent */ }
    },
    route: function (path) {
      try {
        if (typeof window !== 'undefined' && typeof window.si === 'function') {
          window.si('route', { route: typeof path === 'string' ? path : (path && path[0]) || '/' });
        }
      } catch (e) { /* silent */ }
    }
  };
