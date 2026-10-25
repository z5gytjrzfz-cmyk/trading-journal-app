// Einstellungen
(function (J) {
  const h = J.h;

  // Editor für eine Liste von Objekten
  function listEditor(list, cols, blank) {
    const box = h('div');
    const draw = () => {
      J.clear(box).append(h('div.scroll', h('table.edit',
        h('thead', h('tr', cols.map(c => h('th', c.label)), h('th'))),
        h('tbody', list.map((it, i) => h('tr',
          cols.map(c => h('td', c.render ? c.render(it) : J.inp(it, c.key, c.attrs || {}))),
          h('td.nowrap',
            i > 0 ? h('button.x', { type: 'button', title: 'nach oben', onclick: () => { [list[i - 1], list[i]] = [list[i], list[i - 1]]; draw(); } }, '↑') : null,
            h('button.x', { type: 'button', title: 'entfernen', onclick: () => { if (J.confirm('Eintrag entfernen?')) { list.splice(i, 1); draw(); } } }, '×'))))))),
      J.btn('+ hinzufügen', () => { list.push(blank()); draw(); }, 'small ghost'));
    };
    draw();
    return box;
  }
  const invertCol = { label: '„Ja“ ist negativ', render: it => J.chk(it, 'invert', '') };

  J.renderSettings = async (main) => {
    const s = JSON.parse(JSON.stringify(J.store.settings));
    s.markets.forEach(m => { m._cur = (m.currencies || []).join(', '); });
    const meta = { newsCur: s.newsCurrencies.join(', '), impacts: s.rules.newsImpacts.join(', ') };
    const syncBox = h('div', 'Lade …');

    async function save() {
      s.markets.forEach(m => { m.currencies = m._cur.split(/[ ,;]+/).map(x => x.trim().toUpperCase()).filter(Boolean); delete m._cur; m.id = String(m.id).toUpperCase().replace(/[^A-Z0-9]/g, ''); });
      s.newsCurrencies = meta.newsCur.split(/[ ,;]+/).map(x => x.trim().toUpperCase()).filter(Boolean);
      s.rules.newsImpacts = meta.impacts.split(/[ ,;]+/).map(x => x.trim()).filter(Boolean);
      s.accounts.forEach(a => { a.size = Number(a.size); a.riskPct = Number(a.riskPct); });
      for (const k of ['maxLosses', 'dailyTargetPct', 'minChecklist', 'cooldownLossMin', 'cooldownNewsMin']) s.rules[k] = Number(s.rules[k]);
      await J.api.saveSettings(s);
      J.toast('Einstellungen gespeichert ✓');
      J.render();
    }
    const resetBtn = key => J.btn('Standard wiederherstellen', () => {
      if (!J.confirm('Diese Liste auf den Standard zurücksetzen?')) return;
      s[key] = JSON.parse(JSON.stringify(window.J_DEFAULTS[key])); saveAndRender();
    }, 'small ghost');
    const saveAndRender = async () => { await save(); };

    J.clear(main).append(J.page('Einstellungen', null, J.lockable(
      J.readOnly ? null : J.card(J.mode === 'github' ? 'Verbindung (Handy-Version)' : 'Sicherung (GitHub)', syncBox),
      J.card('Konten', listEditor(s.accounts, [
        { label: 'ID', key: 'id', attrs: { size: 8 } }, { label: 'Name', key: 'name' },
        { label: 'Kontogröße $', key: 'size', attrs: { type: 'number' } }, { label: 'Risiko % (= 1 Trade-Risiko)', key: 'riskPct', attrs: { type: 'number', step: '0.05' } },
      ], () => ({ id: 'konto' + (s.accounts.length + 1), name: 'Neues Konto', size: 100000, riskPct: 1 }))),
      J.card('Märkte', listEditor(s.markets, [
        { label: 'Kürzel', key: 'id', attrs: { size: 8 } }, { label: 'Name', key: 'name' },
        { label: 'News-Währungen', key: '_cur', attrs: { placeholder: 'USD, EUR' } },
        { label: 'Farbe', key: 'color', attrs: { type: 'color' } },
      ], () => ({ id: 'NEU', name: 'Neuer Markt', _cur: 'USD', color: '#888888' }))),
      J.card('Sessions & Regeln (deutsche Zeit)',
        listEditor(s.sessions, [
          { label: 'Name', key: 'name' }, { label: 'von', key: 'from', attrs: { type: 'time' } }, { label: 'bis', key: 'to', attrs: { type: 'time' } },
        ], () => ({ name: 'Session', from: '09:00', to: '12:00' })),
        h('div.grid4',
          J.field('Max. Verlusttrades / Tag', J.inp(s.rules, 'maxLosses', { type: 'number' })),
          J.field('Tagesziel in %', J.inp(s.rules, 'dailyTargetPct', { type: 'number', step: '0.1' })),
          J.field('Mindest-Checkliste %', J.inp(s.rules, 'minChecklist', { type: 'number' })),
          J.field('Pause nach Verlust (min)', J.inp(s.rules, 'cooldownLossMin', { type: 'number' })),
          J.field('Pause nach News (min)', J.inp(s.rules, 'cooldownNewsMin', { type: 'number' })),
          J.field('Relevante News-Wichtigkeit', J.inp(meta, 'impacts'), 'High, Medium oder Low'),
          J.field('Währungen im Kalender', J.inp(meta, 'newsCur'), 'z.B. USD, EUR, GBP, JPY, CNY'),
        )),
      J.card('Feiertage – Länder', listEditor(s.holidayCountries, [
        { label: 'Ländercode', key: 'code', attrs: { size: 4 } }, { label: 'Name', key: 'name' }, { label: 'Region', key: 'region' },
      ], () => ({ code: '', name: '', region: '' })), h('p.muted.small', 'Ländercodes nach ISO, z.B. US, GB, DE, FR, JP, CN, HK, AU, CH.')),
      J.card('Signifikanz-Checkliste', listEditor(s.checklist, [
        { label: 'Abschnitt', key: 'section', attrs: { size: 12 } }, { label: 'Frage', key: 'text', attrs: { size: 50 } },
        { label: 'Zusatzfeld', key: 'detail', attrs: { size: 10, placeholder: 'z.B. TF' } }, invertCol,
      ], () => ({ id: J.uid('c'), section: 'Trading-Setup', text: '' })), resetBtn('checklist')),
      J.card('Nachbewertung – Ausführung', listEditor(s.executionQuestions, [{ label: 'Frage', key: 'text', attrs: { size: 60 } }, invertCol],
        () => ({ id: J.uid('e'), text: '' })), resetBtn('executionQuestions')),
      J.card('Nachbewertung – Emotionen', listEditor(s.emotionQuestions, [
        { label: 'Phase', key: 'phase', attrs: { size: 14 } }, { label: 'Frage', key: 'text', attrs: { size: 50 } }, invertCol],
      () => ({ id: J.uid('m'), phase: 'Vor dem Trade', text: '', invert: true })), resetBtn('emotionQuestions')),
      J.card('Reflexionsfragen (Trade)', listEditor(s.reflectionQuestions, [{ label: 'Frage', key: 'text', attrs: { size: 70 } }],
        () => ({ id: J.uid('r'), text: '' })), resetBtn('reflectionQuestions')),
      J.card('Wochen-Review Fragen', listEditor(s.reviewQuestions, [{ label: 'Frage', key: 'text', attrs: { size: 70 } }],
        () => ({ id: J.uid('w'), text: '' })), resetBtn('reviewQuestions')),
      J.card('Regel-Texte', s.ruleTexts.map((r, i) => J.field(`Regel ${i + 1}`, J.inp(s.ruleTexts, i, { size: 90 })))),
      ), J.saveBar(save),
    ));
    if (J.mode === 'github') {
      J.clear(syncBox).append(h('div',
        h('p', `✓ Verbunden mit ${J.gh.cfg.owner}/${J.gh.cfg.repo}. Alles wird direkt dort gespeichert.`),
        J.btn('Auf diesem Gerät abmelden', () => {
          if (!J.confirm('Zugangsschlüssel von diesem Gerät löschen? Deine Daten auf GitHub bleiben erhalten.')) return;
          J.gh.logout(); location.reload();
        }, 'small danger ghost')));
    } else if (!J.readOnly) J.drawSyncDetails(syncBox);
  };

  J.drawSyncDetails = async (box) => {
    let st;
    try { st = await J.api.gitStatus(); } catch { box.textContent = 'Status nicht verfügbar.'; return; }
    J.clear(box).append(h('div',
      h('p', !st.repo ? 'Noch keine Sicherung eingerichtet.' : st.remote ? '✓ Mit GitHub verbunden.' : 'Lokale Sicherung aktiv – GitHub ist noch nicht verbunden.'),
      st.repo ? h('p.muted', `${st.changes} geänderte Datei(en) · ${st.ahead} Sicherung(en) noch nicht hochgeladen${st.lastSync ? ' · zuletzt hochgeladen ' + new Date(st.lastSync).toLocaleString('de-DE') : ''}`) : null,
      h('p.muted.small', 'Die Verbindung zu GitHub richtet Claude mit dir zusammen ein. Danach reicht ein Klick auf „Sichern“ unten links.')));
  };
})(window.J);
