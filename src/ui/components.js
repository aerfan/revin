// ------------------------------------------------------------------ small components
  function Icon(p) {
    var size = p.size || 16;
    return html`<svg class="ic" width=${size} height=${size} viewBox="0 0 256 256" fill="currentColor" aria-hidden="true" dangerouslySetInnerHTML=${{ __html: ICONS[p.name] || ICONS.box }}></svg>`;
  }
  function Duo(p) {
    var size = p.size || 18;
    return html`<svg class="ic" width=${size} height=${size} viewBox="0 0 256 256" fill="currentColor" aria-hidden="true" dangerouslySetInnerHTML=${{ __html: DUO[p.name] || DUO.box }}></svg>`;
  }
  function Tile(p) {
    var cls = 'tile' + (p.size ? ' ' + p.size : '') + ' t-' + (p.color || 'gray');
    var px = p.size === 'sm' ? 14 : p.size === 'lg' ? 20 : 17;
    return html`<span class=${cls} aria-hidden="true">${p.duo ? html`<${Duo} name=${p.icon} size=${px + 2} />` : html`<${Icon} name=${p.icon} size=${px} />`}</span>`;
  }
  function SvcTile(p) { var s = p.svc || {}; return html`<${Tile} duo icon=${s.icon || 'box'} color=${s.icon ? svcColor(s) : 'gray'} size=${p.size} />`; }
  function CardHead(p) {
    return html`<div class="panel-head">
      ${p.icon ? html`<${Tile} icon=${p.icon} color=${p.color} duo=${p.duo} />` : null}
      <div><h2>${p.title}</h2>${p.desc ? html`<p>${p.desc}</p>` : null}</div>
      ${p.right || null}
    </div>`;
  }
  function BrandLogo(p) {
    var size = p && p.size;
    return html`<span class="brand-logo" style=${size ? 'font-size:' + size + 'px' : ''} aria-label="Revin">Revin</span>`;
  }
  function BrandMark(p) {
    return BrandLogo(p);
  }
  // Avatar with an initials fallback for a missing or failing image.
  function Avatar(p) {
    var sf = useState(false), failed = sf[0], setFailed = sf[1];
    var cls = 'av' + (p.sm ? ' sm' : '');
    if (!p.url || failed) return html`<span class=${cls + ' ini'} title=${p.title || null} aria-hidden="true">${initials(p.name)}</span>`;
    return html`<img class=${cls} src=${p.url} alt="" title=${p.title || null} onError=${function () { setFailed(true); }} />`;
  }
  // A title field that wraps instead of hiding the end of a long name.
  function TitleText(p) {
    var ref = useRef(null);
    function fit() { var el = ref.current; if (!el) return; el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; }
    useEffect(fit, [p.value]);
    useEffect(function () { window.addEventListener('resize', fit); return function () { window.removeEventListener('resize', fit); }; }, []);
    return html`<textarea ref=${ref} rows="1" class=${p.cls} id=${p.id} maxlength=${p.max} aria-label=${p.label} placeholder=${p.placeholder} value=${p.value}
      onKeyDown=${function (e) { if (e.key === 'Enter') { e.preventDefault(); e.target.blur(); } }}
      onInput=${function (e) { var v = e.target.value.replace(/[\r\n]+/g, ' '); if (v !== e.target.value) e.target.value = v; fit(); p.onInput(v); }}></textarea>`;
  }
  function Hrs(p) {
    var cls = 'hrs' + (p.ghost ? ' ghost' : '') + (p.soft ? ' soft' : '') + (p.lg ? ' lg' : '');
    return html`<span class=${cls}>${E.fmtHours(p.v)}</span>`;
  }
  function Stepper(p) {
    var step = p.step || 0.5, min = p.min === undefined ? 0 : p.min, max = p.max === undefined ? 1000 : p.max;
    var whole = p.whole !== undefined ? p.whole : (step === 1 && p.unit !== '%');
    var value = E.num(p.value);
    var st = useState(E.plainNum(value)), text = st[0], setText = st[1];
    var focused = useRef(false);
    // Outside changes (steppers, other viewers) update the field, but never while someone is typing in it.
    useEffect(function () { if (!focused.current) setText(E.plainNum(value)); }, [value]);
    function parse(raw) { var n = parseFloat(String(raw).replace(',', '.')); return isFinite(n) ? (whole ? Math.round(n) : Math.round(n * 100) / 100) : null; }
    function live(raw) { var n = parse(raw); if (n !== null && n >= min && n <= max && n !== value) p.onChange(n); }
    function commit(raw) {
      var n = parse(raw);
      if (n === null) n = value;
      n = Math.min(max, Math.max(min, n));
      setText(E.plainNum(n));
      if (n !== value) p.onChange(n);
    }
    function bump(d) { p.onChange(Math.min(max, Math.max(min, Math.round((value + d) * 100) / 100))); }
    return html`<span class="stepper" data-stepper=${p.id}>
      <button type="button" aria-label=${'Decrease ' + (p.label || '')} disabled=${p.disabled || value <= min} onClick=${function () { bump(-step); }}><${Icon} name="minus" size=${12} /></button>
      <span class="stepper-val">
        <input id=${p.id} inputmode="decimal" aria-label=${p.label || 'Value'} value=${text} disabled=${p.disabled}
          style=${{ width: Math.max(1, (text || '').length) + 'ch' }}
          onFocus=${function () { focused.current = true; }}
          onInput=${function (e) { setText(e.target.value); live(e.target.value); }}
          onBlur=${function (e) { focused.current = false; commit(e.target.value); }}
          onKeyDown=${function (e) { if (e.key === 'Enter') { e.preventDefault(); commit(e.target.value); } }} />
        ${p.unit ? html`<span class="unit">${p.unit}</span>` : null}
      </span>
      <button type="button" aria-label=${'Increase ' + (p.label || '')} disabled=${p.disabled || value >= max} onClick=${function () { bump(step); }}><${Icon} name="plus" size=${12} /></button>
    </span>`;
  }
  function Switch(p) {
    return html`<span class="switch"><input type="checkbox" role="switch" id=${p.id} aria-label=${p.label} checked=${!!p.checked} disabled=${p.disabled} onChange=${function (e) { p.onChange(e.target.checked); }} /></span>`;
  }
  function Seg(p) {
    return html`<div class=${'seg ' + (p.cls || '')} role="group" aria-label=${p.label}>
      ${p.options.map(function (o) {
        return html`<button type="button" key=${o.value} data-v=${o.value} title=${o.title || ''} aria-pressed=${o.value === p.value ? 'true' : 'false'} onClick=${function () { p.onChange(o.value); }}>${o.label}</button>`;
      })}
    </div>`;
  }
  // A textarea that grows with its text, so long lines are never clipped.
  function AutoText(p) {
    var ref = useRef(null);
    function fit() { var el = ref.current; if (!el) return; el.style.height = 'auto'; el.style.height = el.scrollHeight + 2 + 'px'; }
    useEffect(fit, [p.value]);
    return html`<textarea ref=${ref} class="input auto-text" rows="1" maxlength="1000" id=${p.id} aria-label=${p.label} placeholder=${p.placeholder || ''} value=${p.value} onInput=${function (e) { fit(); p.onInput(e); }}></textarea>`;
  }
  function StringList(p) {
    var st = useState(''), text = st[0], setText = st[1];
    var se = useState(''), err = se[0], setErr = se[1];
    var values = p.values || [];
    function dup(t, skip) { return p.unique && values.some(function (v, j) { return j !== skip && String(v).trim().toLowerCase() === t.toLowerCase(); }); }
    return html`<div class="str-list">
      ${values.map(function (v, i) {
        return html`<div class="str-row" key=${i}>
          <${AutoText} id=${p.idPrefix + '-' + i} label=${p.label + ' ' + (i + 1)} value=${v} onInput=${function (e) { var n = values.slice(); n[i] = e.target.value; p.onChange(n); }} />
          <button type="button" class="icon-btn danger" aria-label=${'Remove ' + p.label + ' ' + (i + 1)} onClick=${function () { p.onChange(values.filter(function (_, j) { return j !== i; })); }}><${Icon} name="trash" /></button>
        </div>`;
      })}
      <form class="str-row" onSubmit=${function (e) { e.preventDefault(); var t = text.trim(); if (!t) return; if (dup(t)) { setErr(t + ' is already in the list.'); return; } setErr(''); p.onChange(values.concat(t)); setText(''); }}>
        <input class="input" id=${p.idPrefix + '-new'} aria-label=${p.placeholder || ('Add ' + p.label)} maxlength="1000" placeholder=${p.placeholder} value=${text} onInput=${function (e) { setText(e.target.value); setErr(''); }} />
        <button class="btn" type="submit"><${Icon} name="plus" /> Add</button>
      </form>
      ${err ? html`<span class="hint" role="alert" style="color:var(--red-fg)">${err}</span>` : null}
      ${p.unique && values.some(function (v, i) { return v.trim() && dup(v.trim(), i); }) ? html`<span class="hint" role="alert" style="color:var(--red-fg)">The same name appears twice. Duplicates are merged when you save.</span>` : null}
    </div>`;
  }
  function Modal(p) {
    // the opener is captured during the first render and focus moves in before the browser paints,
    // so even an instant second key press lands inside the dialog
    var box = useRef(null), ok = useRef(null), opener = useRef(document.activeElement);
    var sc = useState(false), closing = sc[0], setClosing = sc[1];
    // Dismissal plays a short exit; confirming acts at once.
    var dismiss = useRef(null);
    dismiss.current = function () { if (closing) return; setClosing(true); setTimeout(p.onClose, 140); };
    useLayoutEffect(function () {
      var prev = opener.current;
      if (ok.current) ok.current.focus();
      function onKey(e) {
        if (e.key === 'Escape') { e.preventDefault(); dismiss.current(); return; }
        if (e.key !== 'Tab' || !box.current) return;
        var f = Array.prototype.slice.call(box.current.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')).filter(function (x) { return !x.disabled; });
        if (!f.length) return;
        var first = f[0], last = f[f.length - 1], act = document.activeElement;
        if (!box.current.contains(act)) { e.preventDefault(); first.focus(); }
        else if (e.shiftKey && act === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && act === last) { e.preventDefault(); first.focus(); }
      }
      window.addEventListener('keydown', onKey);
      return function () { window.removeEventListener('keydown', onKey); try { if (prev && prev.focus && document.contains(prev)) prev.focus(); } catch (e) { /* ignore */ } };
    }, []);
    return html`<div class=${'modal-scrim' + (closing ? ' closing' : '')} onClick=${function (e) { if (e.target === e.currentTarget) dismiss.current(); }}>
      <div class="modal" ref=${box} role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <h2 id="modal-title">${p.title}</h2>
        ${p.body ? html`<p>${p.body}</p>` : null}
        <div class="row">
          <button class="btn ghost" type="button" onClick=${function () { dismiss.current(); }}>Cancel</button>
          <button ref=${ok} class=${'btn ' + (p.danger ? 'danger solid' : 'primary')} type="button" onClick=${function () { p.onClose(); p.onConfirm(); }}>${p.confirmLabel || 'Confirm'}</button>
        </div>
      </div>
    </div>`;
  }
  function Notice(p) {
    return html`<main class="notice" id="main-content">
      <div class="brand-mark"><${BrandMark} /></div>
      <h1>${p.title}</h1>
      <p>${p.children}</p>
    </main>`;
  }
