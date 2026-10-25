// Auswertungen, Wochen-Review, Regeln, Teilen
(function (J) {
  const h = J.h;
  const P = { type: J.readOnly ? 'all' : 'month', anchor: null, account: 'all', from: '', to: '' };

  function periodRange() {
    const a = P.anchor || J.today();
    if (P.type === 'week') return { ...J.weekRange(a), label: `KW ${J.weekId(a).split('-W')[1]} (${J.fmtShort(J.weekStart(a))} – ${J.fmtShort(J.addDays(J.weekStart(a), 6))}${a.slice(0, 4)})` };
    if (P.type === 'month') { const d = J.parse(a); return { ...J.monthRange(a), label: `${J.MON[d.getMonth()]} ${d.getFullYear()}` }; }
    if (P.type === 'year') return { from: a.slice(0, 4) + '-01-01', to: a.slice(0, 4) + '-12-31', label: a.slice(0, 4) };
    if (P.type === 'custom') return { from: P.from || '2000-01-01', to: P.to || '2100-01-01', label: 'Zeitraum' };
    return { from: '2000-01-01', to: '2100-12-31', label: 'Gesamter Zeitraum' };
  }
  function shift(n) {
    const a = P.anchor || J.today(), d = J.parse(a);
    if (P.type === 'week') P.anchor = J.addDays(a, 7 * n);
    else if (P.type === 'month') P.anchor = J.dateKey(new Date(d.getFullYear(), d.getMonth() + n, 1));
    else if (P.type === 'year') P.anchor = `${d.getFullYear() + n}-01-01`;
    J.render();
  }

  const pctOr = v => (v == null ? '–' : Math.round(v) + '%');
  function summaryRow(label, s) {
    return h('tr', h('th', label), h('td', s.closed), h('td', `${s.wins} / ${s.losses} / ${s.be}`), h('td', pctOr(s.winrate)),
      h('td', { class: J.signClass(s.sumR) }, h('b', J.fmtR(s.sumR))), h('td', { class: J.signClass(s.sumPct) }, J.fmtPct(s.sumPct)),
      h('td', { class: J.signClass(s.sumUsd) }, J.fmtUsd(s.sumUsd)), h('td', J.fmtR(s.avgR)),
      h('td', s.profitFactor == null ? '–' : J.num(s.profitFactor, 2)), h('td.pos', J.fmtR(s.best)), h('td.neg', J.fmtR(s.worst)),
      h('td', J.fmtDuration(s.avgHold)), h('td', { class: s.violations ? 'neg' : '' }, s.violations));
  }
  J.summaryTable = (from, to, extra) => {
    const S = J.store.settings;
    return h('div.scroll', h('table.list.sum',
      h('thead', h('tr', ['Konto', 'Trades', 'W / L / BE', 'Winrate', 'Summe R', '%', '$', 'Ø R', 'Profit-Faktor', 'Bester', 'Schlechtester', 'Ø Haltedauer', 'Regelverstöße'].map(x => h('th', x)))),
      h('tbody', S.accounts.map(a => summaryRow(a.name, J.stats(J.filterTrades({ from, to, account: a.id, ...extra })))))));
  };

  J.renderReports = (main) => {
    const S = J.store.settings, rg = periodRange();
    const trades = J.filterTrades({ from: rg.from, to: rg.to, account: P.account });
    const st = J.stats(trades);
    const closed = trades.filter(t => J.calc(t).closed);
    const toolbar = h('div.toolbar',
      h('div.seg', [['week', 'Woche'], ['month', 'Monat'], ['year', 'Jahr'], ['all', 'Gesamt'], ['custom', 'Frei']].map(([v, l]) =>
        h('button', { type: 'button', class: P.type === v ? 'on' : '', onclick: () => { P.type = v; J.render(); } }, l))),
      ['week', 'month', 'year'].includes(P.type) ? [J.btn('‹', () => shift(-1), 'ghost'), J.btn('›', () => shift(1), 'ghost')] : null,
      P.type === 'custom' ? [J.inp(P, 'from', { type: 'date' }, () => J.render()), J.inp(P, 'to', { type: 'date' }, () => J.render())] : null,
      J.sel(P, 'account', [['all', 'Alle Konten'], ...S.accounts.map(a => [a.id, a.name])], () => J.render()));
    const errors = J.badAnswers(closed, S.executionQuestions, 'execution').filter(x => x.bad);
    const emos = J.badAnswers(closed, S.emotionQuestions, 'emotions').filter(x => x.bad);
    const viol = J.ruleViolationCounts(trades);
    const wd = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
    J.clear(main).append(J.page(`Auswertung · ${rg.label}`, [toolbar],
      J.card('Pro Konto', J.summaryTable(rg.from, rg.to)),
      h('div.kpis',
        J.kpi('Trades', st.closed, '', `${st.open} offen`), J.kpi('Winrate', pctOr(st.winrate), '', `${st.wins} W · ${st.losses} L · ${st.be} BE`),
        J.kpi('Summe R', J.fmtR(st.sumR), J.signClass(st.sumR), J.fmtPct(st.sumPct)), J.kpi('Ø Gewinner', J.fmtR(st.avgWin), 'pos'),
        J.kpi('Ø Verlierer', J.fmtR(st.avgLoss), 'neg'), J.kpi('Max. Drawdown', J.fmtR(st.maxDD), st.maxDD < 0 ? 'neg' : ''),
        J.kpi('Regelverstöße', st.violations, st.violations ? 'neg' : 'pos', `in ${st.tradesWithViolations} Trades`)),
      J.card('Equity-Kurve (R)' + (P.account === 'all' ? ' – alle Konten' : ''), J.equityChart(st.equity)),
      h('div.two',
        J.card('Nach Markt', J.barList(J.groupStats(closed, t => t.market), k => J.market(k).name)),
        J.card('Nach Session', J.barList(J.groupStats(closed, t => J.calc(t).session, [...S.sessions.map(s => s.name), 'Außerhalb'])))),
      h('div.two',
        J.card('Nach Wochentag', J.barList(J.groupStats(closed, t => wd[(J.parse(t.entryTime).getDay() + 6) % 7], wd))),
        J.card('Nach Richtung', J.barList(J.groupStats(closed, t => (t.direction === 'short' ? 'Short' : 'Long'), ['Long', 'Short'])))),
      h('div.two',
        J.card('Nach Checklisten-Score', J.barList(J.groupStats(closed, J.scoreBucket, ['85–100%', '70–84%', '50–69%', 'unter 50%', 'nicht ausgefüllt']))),
        J.card('Regeln eingehalten vs. gebrochen', J.barList(J.groupStats(closed, t => ((t.violations || []).length ? 'Mit Regelverstoß' : 'Regelkonform'), ['Regelkonform', 'Mit Regelverstoß'])))),
      h('div.two',
        J.card('Häufigste Ausführungsfehler', errors.length ? h('ul.toplist', errors.map(x => h('li', h('b', `${x.bad}×`), ' ', x.q.text))) : h('div.muted', 'Keine – oder noch keine Nachbewertungen.')),
        J.card('Häufigste Emotionen', emos.length ? h('ul.toplist', emos.map(x => h('li', h('b', `${x.bad}×`), ' ', x.q.text))) : h('div.muted', 'Keine – oder noch keine Nachbewertungen.'))),
      J.card('Regelverstöße', viol.length ? h('ul.toplist', viol.map(x => h('li', h('b', `${x.c}×`), ` Regel ${x.n}: ${S.ruleTexts[x.n - 1]}`))) : h('div.pos', '✓ Keine Regelverstöße im Zeitraum.')),
      J.card('Trades im Zeitraum', J.tradeTable(trades.slice().reverse())),
    ));
  };

  // ---------- Wochen-Review ----------
  J.renderReview = (main, weekId) => {
    const S = J.store.settings;
    weekId = weekId || J.weekId(J.today());
    const { from, to } = J.weekRangeFromId(weekId);
    const existing = J.byId(J.store.reviews, weekId);
    const m = existing ? JSON.parse(JSON.stringify(existing)) : { id: weekId, from, to, answers: {}, done: false, rating: '' };
    m.answers = m.answers || {};
    const trades = J.filterTrades({ from, to });
    const closed = trades.filter(t => J.calc(t).closed);
    const errors = J.badAnswers(closed, S.executionQuestions, 'execution').filter(x => x.bad).slice(0, 5);
    const emos = J.badAnswers(closed, S.emotionQuestions, 'emotions').filter(x => x.bad).slice(0, 5);
    const viol = J.ruleViolationCounts(trades);
    const prev = J.weekId(J.addDays(from, -7)), next = J.weekId(J.addDays(from, 7));
    const past = [...J.store.reviews].sort((a, b) => b.id.localeCompare(a.id)).slice(0, 12);
    async function save() {
      await J.api.save('reviews', m);
      J.toast('Review gespeichert ✓');
      J.render();
    }
    J.clear(main).append(J.page(`Wochen-Review KW ${weekId.split('-W')[1]} · ${J.fmtShort(from)} – ${J.fmtShort(to)}${to.slice(0, 4)}`,
      [J.btn('‹', () => J.go('#/review/' + prev), 'ghost'), J.btn('›', () => J.go('#/review/' + next), 'ghost')],
      J.card('Zahlen der Woche', J.summaryTable(from, to)),
      h('div.two',
        J.card('Fehler & Emotionen',
          errors.length ? h('ul.toplist', errors.map(x => h('li', h('b', `${x.bad}×`), ' ', x.q.text))) : h('div.muted', 'Keine Ausführungsfehler markiert.'),
          emos.length ? h('ul.toplist', emos.map(x => h('li', h('b', `${x.bad}×`), ' ', x.q.text))) : h('div.muted', 'Keine Emotionen markiert.')),
        J.card('Regelverstöße', viol.length ? h('ul.toplist', viol.map(x => h('li', h('b', `${x.c}×`), ` Regel ${x.n}: ${S.ruleTexts[x.n - 1]}`))) : h('div.pos', '✓ Keine Regelverstöße.'))),
      J.card('Trades der Woche', J.tradeTable(trades.slice().reverse())),
      J.lockable(J.card('Reflexion der Woche',
        S.reviewQuestions.map(q => J.field(q.text, J.txt(m.answers, q.id))),
        h('div.grid4',
          J.field('Zufriedenheit mit der Woche', J.seg(m, 'rating', [['1', '1'], ['2', '2'], ['3', '3'], ['4', '4'], ['5', '5']])),
          J.field('Status', J.chk(m, 'done', 'Review erledigt (Regel 10)'))))),
      J.saveBar(save),
      past.length ? J.card('Frühere Reviews', h('div.chips', past.map(r => J.link(`KW ${r.id.split('-W')[1]}/${r.id.slice(0, 4)} ${r.done ? '✓' : ''}`, '#/review/' + r.id, 'chip')))) : null,
    ));
  };

  // ---------- Regeln ----------
  J.renderRules = (main) => {
    const S = J.store.settings;
    const all = J.ruleViolationCounts(J.store.trades);
    const m = J.monthRange(J.today());
    const month = J.ruleViolationCounts(J.filterTrades(m));
    const cnt = (list, n) => (list.find(x => x.n === n) || { c: 0 }).c;
    J.clear(main).append(J.page('Kompromisslose Regeln', null,
      J.card(null, h('table.list', h('thead', h('tr', h('th', '#'), h('th', 'Regel'), h('th', 'Verstöße diesen Monat'), h('th', 'Verstöße gesamt'))),
        h('tbody', S.ruleTexts.map((r, i) => h('tr', h('td', h('b', i + 1)), h('td', r),
          h('td', { class: cnt(month, i + 1) ? 'neg' : 'pos' }, cnt(month, i + 1)), h('td', cnt(all, i + 1))))))),
      h('p.muted', 'Regel 1–9 werden bei jedem Trade automatisch geprüft. Regel 10 erinnert dich samstags im Kalender an das Wochen-Review.'),
    ));
  };

  // ---------- Teilen (Nur-Lesen) ----------
  J.renderShare = (main) => {
    const S = J.store.settings, mr = J.monthRange(J.today());
    const m = { from: mr.from, to: mr.to, account: 'all', images: true };
    const out = h('div');
    async function create() {
      out.textContent = 'Erstelle …';
      try {
        const r = await J.api.snapshot({ ...m, staticHtml: J.buildStaticReport(m) });
        J.clear(out).append(h('div.note.ok',
          h('div', '✓ Datei erstellt: ', h('b', r.file), ` (${J.num(r.size / 1024 / 1024, 1)} MB)`),
          h('div', 'Sie liegt im Ordner „Freigaben“ in deinem Journal-Ordner. Du kannst sie per Mail, WhatsApp oder AirDrop verschicken – der Empfänger öffnet sie einfach im Browser. Ändern kann er nichts.'),
          J.btn('Im Finder zeigen', () => J.api.reveal(r.file), 'small')));
      } catch (e) { out.textContent = 'Fehler: ' + e.message; }
    }
    J.clear(main).append(J.page('Nur-Lesen-Ansicht teilen', null,
      J.card('Was wird geteilt?',
        h('p', 'Es wird eine einzelne Datei erstellt, die Kalender, Trades, Analysen, Reviews und Auswertungen des Zeitraums enthält. Der Empfänger kann alles ansehen und filtern, aber nichts ändern – deine echten Daten bleiben nur bei dir.'),
        h('div.grid4',
          J.field('Von', J.inp(m, 'from', { type: 'date' })), J.field('Bis', J.inp(m, 'to', { type: 'date' })),
          J.field('Konto', J.sel(m, 'account', [['all', 'Alle Konten'], ...S.accounts.map(a => [a.id, a.name])])),
          J.field('Screenshots', J.chk(m, 'images', 'mitschicken'))),
        h('p.muted.small', 'Tipp: Achte darauf, dass auf deinen Screenshots keine Kontonummern oder Namen zu sehen sind.'),
        J.btn('Datei erstellen', create, 'primary'), out),
    ));
  };
})(window.J);
