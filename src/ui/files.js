// ------------------------------------------------------------------ files
  async function saveFile(ctx, filename, blob) {
    var dl = ctx.caps && ctx.caps.downloads;
    if (dl) {
      try { await dl.save({ filename: filename, data: blob }); ctx.toast('Saved ' + filename); }
      catch (e) {
        var code = e && e.code;
        if (code === 'declined') return;
        if (code === 'rate_limited') ctx.toast('A save prompt is already open. Finish it, then try again.', 'bad');
        else if (code === 'extension_not_enabled') ctx.toast('This file type is turned off here. Try the other export format.', 'bad');
        else ctx.toast('The file could not be saved here. Open the estimator in claude.ai and try again.', 'bad');
      }
      return;
    }
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }
  var fileBase = E.fileBase;
  var DOC_LIMIT = 262144;
  var EST_PAGE = 500;
  function byteSize(o) { try { return new TextEncoder().encode(JSON.stringify(o)).length; } catch (e) { return 0; } }
  function norm(d) { return E.clone(E.normalize(d)); }

  // Three-way merge for when a teammate saves while you have unsaved edits: anything you changed
  // since the last stored version wins, everything you did not touch takes their version.
  // Lists of rows with a key/id (items, deliverables, register entries) merge row by row.
  function sameJ(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
  function isPlain(x) { return !!x && typeof x === 'object' && !Array.isArray(x); }
  function rowKey(x) { return isPlain(x) ? ((typeof x.key === 'string' && x.key) || (typeof x.id === 'string' && x.id) || null) : null; }
  function keyedRows(a) { return Array.isArray(a) && a.every(function (x) { return rowKey(x) !== null; }); }
  function merge3(b, l, r) {
    if (sameJ(l, b)) return r;
    if (sameJ(r, b) || sameJ(r, l)) return l;
    if (isPlain(b) && isPlain(l) && isPlain(r)) {
      var out = {}, ks = Object.create(null);
      Object.keys(l).concat(Object.keys(r)).forEach(function (k) { ks[k] = 1; });
      Object.keys(ks).forEach(function (k) { var v = merge3(b[k], l[k], r[k]); if (v !== undefined) out[k] = v; });
      return out;
    }
    if (keyedRows(b) && keyedRows(l) && keyedRows(r)) {
      var bm = Object.create(null), rm = Object.create(null), seenK = Object.create(null), res = [];
      b.forEach(function (x) { bm[rowKey(x)] = x; });
      r.forEach(function (x) { rm[rowKey(x)] = x; });
      l.forEach(function (x) {
        var k = rowKey(x);
        if (seenK[k]) return;
        if (bm[k] && !rm[k] && sameJ(x, bm[k])) return; // they removed a row you did not touch
        seenK[k] = 1;
        res.push(bm[k] && rm[k] ? merge3(bm[k], x, rm[k]) : x);
      });
      r.forEach(function (x) { var k = rowKey(x); if (!seenK[k] && !bm[k]) { seenK[k] = 1; res.push(x); } }); // rows they added
      return res;
    }
    return l;
  }
