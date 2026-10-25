// Navigation, Routing, Sicherungs-Anzeige
(function (J) {
  const h = J.h;
  const NAV = [
    ['#/kalender', '📅 Kalender'],
    ['#/analysen', '📊 Märkte & Analysen'],
    ['#/trades', '💹 Trades'],
    ['#/auswertung', '📈 Auswertung'],
    ['#/review', '📝 Wochen-Review'],
    ['#/regeln', '⚖️ Regeln'],
    ['#/teilen', '🔗 Teilen', true],
    ['#/einstellungen', '⚙️ Einstellungen'],
  ];

  function drawNav(route) {
    const nav = J.clear(document.getElementById('nav'));
    for (const [href, label, hideRO] of NAV) {
      if (hideRO && (J.readOnly || J.mode === 'github')) continue;
      nav.append(h('a', { href, class: route.startsWith(href.slice(1)) ? 'on' : '' }, label));
    }
    nav.append(h('div.navsec', 'Märkte'));
    for (const m of J.store.settings.markets) {
      nav.append(h('a', { href: '#/markt/' + m.id, class: 'sub ' + (route === '/markt/' + m.id ? 'on' : '') }, J.marketDot(m.id), m.name));
    }
  }

  J.render = async () => {
    const hash = location.hash.slice(1) || '/kalender';
    const [route, query] = hash.split('?');
    const params = new URLSearchParams(query || '');
    const parts = route.split('/').filter(Boolean);
    const main = document.getElementById('main');
    drawNav(route);
    try {
      switch (parts[0]) {
        case 'analysen': J.renderAnalysesOverview(main); break;
        case 'markt': J.renderMarket(main, parts[1]); break;
        case 'analyse': J.renderAnalysis(main, parts[1], params); break;
        case 'trades': J.renderTrades(main); break;
        case 'trade': await J.renderTrade(main, parts[1], params); break;
        case 'auswertung': J.renderReports(main); break;
        case 'review': J.renderReview(main, parts[1]); break;
        case 'regeln': J.renderRules(main); break;
        case 'teilen': J.renderShare(main); break;
        case 'einstellungen': await J.renderSettings(main); break;
        default: await J.renderCalendar(main, params);
      }
    } catch (err) {
      console.error(err);
      J.clear(main).append(h('div.empty.neg', 'Fehler: ' + err.message));
    }
    if (!J._keepScroll) window.scrollTo(0, 0);
  };

  // Sicherung unten links
  J.sync = {
    async refresh() {
      const box = document.getElementById('sync');
      if (J.readOnly) {
        const s = window.__SNAPSHOT__;
        J.clear(box).append(h('div.ro', '👁 Nur-Lesen-Ansicht', h('div.small', `${J.fmtDate(s.from)} – ${J.fmtDate(s.to)}`), h('div.small', 'erstellt ' + new Date(s.createdAt).toLocaleString('de-DE'))));
        return;
      }
      if (J.mode === 'github') {
        J.clear(box).append(
          h('div.sync-st.ok', '☁︎ Speichert direkt auf GitHub'),
          J.btn('↻ Neu laden', async (e) => {
            e.target.disabled = true;
            try { await J.api.reload(); J.render(); J.toast('Neu geladen'); } catch (err) { J.toast(err.message, 'err'); }
            e.target.disabled = false;
          }, 'small'));
        return;
      }
      let st;
      try { st = await J.api.gitStatus(); } catch { return; }
      const pending = st.changes + st.ahead;
      const label = !st.repo ? 'Noch nie gesichert' : !st.remote ? (st.changes ? `${st.changes} Änderung(en) ungesichert` : 'Lokal gesichert · GitHub fehlt')
        : st.behind ? `📱 ${st.behind} neue Änderung(en) vom Handy – Sichern klicken`
        : pending ? `${pending} Änderung(en) nicht auf GitHub` : '✓ Alles gesichert';
      J.clear(box).append(
        h('div', { class: 'sync-st ' + (pending || st.behind || !st.remote ? 'warn' : 'ok') }, label),
        J.btn('☁︎ Sichern', async (e) => {
          e.target.disabled = true; e.target.textContent = 'Sichere …';
          try {
            const r = await J.api.gitSync();
            J.toast(r.message || (r.ok ? 'Gesichert' : 'Fehler'), r.ok ? '' : 'err');
            if (r.pulled) { await J.api.loadAll(); J.render(); }
          } catch (err) { J.toast('Sicherung fehlgeschlagen: ' + err.message, 'err'); }
          J.sync.refresh();
        }, 'small primary'));
    },
  };

  // Einrichtung der Handy-Version: Zugangsschlüssel eingeben
  J.renderGithubSetup = (main) => {
    const m = { owner: (J.gh.cfg && J.gh.cfg.owner) || J.gh.defaultOwner(), repo: (J.gh.cfg && J.gh.cfg.repo) || 'trading-journal', token: '' };
    const out = h('div');
    document.getElementById('nav').append(h('div.muted.small.pad', 'Bitte zuerst verbinden.'));
    async function connect() {
      m.owner = m.owner.trim(); m.repo = m.repo.trim(); m.token = m.token.trim();
      if (!m.owner || !m.repo || !m.token) return J.toast('Bitte alle Felder ausfüllen', 'err');
      J.gh.saveCfg({ owner: m.owner, repo: m.repo, token: m.token, branch: 'main' });
      out.textContent = 'Verbinde …';
      try { await J.gh.test(); location.reload(); }
      catch (e) { J.gh.logout(); out.textContent = 'Das hat nicht geklappt: ' + e.message; }
    }
    J.clear(main).append(J.page('Handy-Version verbinden', null,
      J.card('Einmalig einrichten',
        h('p', 'Diese Seite liest und speichert dein Journal direkt in deinem privaten GitHub-Repository. Dafür brauchst du einen Zugangsschlüssel, den nur du kennst. Er wird nur auf diesem Gerät gespeichert.'),
        h('ol.steps',
          h('li', 'Öffne ', h('a', { href: 'https://github.com/settings/personal-access-tokens/new', target: '_blank', rel: 'noopener' }, 'diese GitHub-Seite'), ' und melde dich an.'),
          h('li', 'Name: „Journal Handy“. Ablauf (Expiration): so lang wie möglich.'),
          h('li', 'Repository access: „Only select repositories“ → ', h('b', m.repo), ' auswählen.'),
          h('li', 'Permissions → Repository permissions → ', h('b', 'Contents'), ' auf „Read and write“.'),
          h('li', '„Generate token“ tippen, den Schlüssel kopieren und unten einfügen.')),
        h('div.grid4',
          J.field('GitHub-Benutzername', J.inp(m, 'owner', { autocapitalize: 'off', autocomplete: 'off' })),
          J.field('Repository', J.inp(m, 'repo', { autocapitalize: 'off', autocomplete: 'off' })),
          J.field('Zugangsschlüssel', J.inp(m, 'token', { type: 'password', autocomplete: 'off', placeholder: 'github_pat_…' }))),
        J.btn('Verbinden', connect, 'primary'), out),
    ));
  };

  window.addEventListener('hashchange', J.render);
  (async () => {
    const main = document.getElementById('main');
    if (J.mode === 'github') {
      J.gh.watchImages();
      if (!J.gh.configured()) { J.renderGithubSetup(main); return; }
    }
    try { await J.api.loadAll(); }
    catch (e) {
      if (J.mode === 'github') {
        main.append(h('div.empty.neg', 'Verbindung zu GitHub fehlgeschlagen: ' + e.message),
          h('div.center', J.btn('Zugang neu einrichten', () => { J.gh.logout(); location.reload(); }), ' ', J.btn('Erneut versuchen', () => location.reload(), 'primary')));
      } else main.append(h('div.empty.neg', 'Server nicht erreichbar. Bitte „Trading Journal“ auf dem Schreibtisch starten.'));
      return;
    }
    if (J.readOnly) {
      // Handy-Version ausblenden (sie ist nur für Geräte ohne JavaScript) und ihre Bilder übernehmen
      const st = document.getElementById('static');
      if (st) {
        J.staticImages = {};
        st.querySelectorAll('img[data-file]').forEach(img => { J.staticImages[img.dataset.file] = img.src; });
        st.remove();
      }
      document.body.classList.remove('nojs');
      document.body.classList.add('readonly');
    }
    J.sync.refresh();
    J.render();
    if (J.mode === 'server') setInterval(J.sync.refresh, 60000);
  })();

})(window.J);
