// ------------------------------------------------------------------ theme switcher
  function ThemeSwitcher(p) {
    var ctx = p.ctx, current = ctx.theme || 'system';
    var options = [
      { id: 'system', icon: 'monitor', label: 'Match system' },
      { id: 'light', icon: 'sun', label: 'Light mode' },
      { id: 'dark', icon: 'moon', label: 'Dark mode' },
    ];
    return html`<div class="theme-switcher" role="radiogroup" aria-label="Color theme">
      ${options.map(function (opt) {
        var active = current === opt.id;
        return html`<button
          key=${opt.id}
          type="button"
          role="radio"
          aria-checked=${active ? 'true' : 'false'}
          aria-label=${opt.label}
          data-tooltip=${opt.label}
          title=${opt.label}
          onClick=${function () { ctx.setTheme(opt.id); }}>
          <${Icon} name=${opt.icon} size=${14} />
        </button>`;
      })}
    </div>`;
  }

  // ------------------------------------------------------------------ sidebar
  function Sidebar(p) {
    var ctx = p.ctx, route = ctx.route, me = ctx.me || {};
    var estActive = route.view === 'estimates' || route.view === 'new' || route.view === 'estimate';
    var recent = (ctx.estimates || []).slice(0, 5);
    var svcById = ctx.services || {};
    function tab(view, label, icon, color, active, count) {
      return html`<button class="navtab" aria-current=${active ? 'page' : null} onClick=${function () { ctx.setRoute({ view: view }); }}>
        <${Tile} size="sm" icon=${icon} color=${color} /><span class="lbl">${label}</span>${count !== undefined ? html`<span class="count">${count}</span>` : null}
      </button>`;
    }
    return html`<aside class="side" aria-label="Sidebar">
      <button class="side-brand" onClick=${function () { ctx.setRoute({ view: 'estimates' }); }} aria-label="Revin home">
        <${BrandLogo} size=${23} />
      </button>
      <button class="btn primary side-new" onClick=${function () { ctx.setRoute({ view: 'new' }); }}><${Icon} name="plus" /> New estimate</button>
      <div>
        <div class="side-label">Workspace</div>
        <nav class="side-nav" aria-label="Main">
          ${tab('estimates', 'Estimates', 'list', 'blue', estActive, ctx.estimates ? E.fmtNum(ctx.estimates.length) + (ctx.hasMore ? '+' : '') : undefined)}
          ${ctx.role === 'admin' ? tab('library', 'Library', 'book', 'purple', route.view === 'library', ctx.serviceList ? ctx.serviceList.length : undefined) : null}
          ${ctx.role === 'admin' ? tab('settings', 'Settings', 'sliders', 'orange', route.view === 'settings') : null}
        </nav>
      </div>
      ${recent.length ? html`<div class="recent">
        <div class="side-label">Recent</div>
        ${recent.map(function (e) {
          return html`<button class="recent-item" key=${e.id} title=${nm(e.name, 'Untitled estimate')} onClick=${function () { ctx.setRoute({ view: 'estimate', id: e.id, step: 'review' }); }}>
            <${SvcTile} size="sm" svc=${svcById[e.serviceId]} /><span><bdi>${nm(e.name, 'Untitled estimate')}</bdi></span>
          </button>`;
        })}
      </div>` : null}
      <div class="side-theme">
        <${ThemeSwitcher} ctx=${ctx} />
      </div>
      <div class="side-foot">
        <${Avatar} key=${me.avatarUrl || 'none'} url=${me.avatarUrl} name=${me.name || 'You'} />
        <div class="who-text"><div class="who-name" title=${nm(me.name, 'You')}><bdi>${nm(me.name, 'You')}</bdi></div></div>
        <span class=${'role ' + (ctx.role === 'admin' ? 'admin' : '')}>${ctx.role === 'admin' ? 'Admin' : 'Estimator'}</span>
        ${ctx.caps && ctx.caps.team ? html`<button class="icon-btn signout" aria-label="Sign out" title="Sign out" onClick=${function () { ctx.caps.team.signOut(); }}><${Icon} name="logout" /></button>` : null}
      </div>
    </aside>`;
  }
