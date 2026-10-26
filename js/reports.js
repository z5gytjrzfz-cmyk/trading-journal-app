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

  // ---------- Gemeinsame Bausteine für Regel- und Review-Fragen ----------
  const KEPT = [['kept', '✓ Eingehalten', 'y'], ['broken', '✗ Gebrochen', 'n']];
  const ruleCount = (trades, n) => trades.filter(t => (t.violations || []).includes(n)).length;
  // Eine Frage mit Auswahl, Auto-Hinweis aus dem Journal und großem Notizfeld
  function questionBlock(title, text, store, choices, hint, notePlaceholder) {
    return h('div.rq',
      h('div.rq-head', title ? h('b', title + ' ') : null, h('span', text)),
      hint ? h('div', { class: 'rq-hint ' + (hint.cls || '') }, hint.text) : null,
      h('div.rq-answer', J.seg(store, 'v', choices)),
      J.txt(store, 'note', { rows: 3, placeholder: notePlaceholder || 'Notiz: Warum? Was ändere ich konkret?' }));
  }

  // ---------- Wochen-Review ----------
  J.renderReview = (main, weekId) => {
    const S = J.store.settings;
    weekId = weekId || J.weekId(J.today());
    const { from, to } = J.weekRangeFromId(weekId);
    const existing = J.byId(J.store.reviews, weekId);
    const m = existing ? JSON.parse(JSON.stringify(existing)) : { id: weekId, from, to, answers: {}, done: false, rating: '' };
    const trades = J.filterTrades({ from, to });
    const closed = trades.filter(t => J.calc(t).closed);
    m.answers = m.answers || {}; m.rules = m.rules || {}; m.execution = m.execution || {}; m.emotions = m.emotions || {}; m.reflection = m.reflection || {};
    // Regeln vorschlagen, wie das Journal sie gesehen hat (nur wenn noch nicht beantwortet)
    S.ruleTexts.forEach((r, i) => {
      const n = i + 1;
      m.rules[n] = m.rules[n] || {};
      if (!m.rules[n].v && n <= 9 && trades.length) m.rules[n].v = ruleCount(trades, n) ? 'broken' : 'kept';
    });
    const bad = (qs, field) => Object.fromEntries(J.badAnswers(closed, qs, field).map(x => [x.q.id, x]));
    const execBad = bad(S.executionQuestions, 'execution'), emoBad = bad(S.emotionQuestions, 'emotions');
    const statHint = (x, invertWord) => !x ? { text: 'Diese Woche bei keinem Trade beantwortet.', cls: 'muted' }
      : x.bad ? { text: `Im Journal bei ${x.bad} von ${x.answered} Trades ${invertWord}.`, cls: 'neg' } : { text: `Im Journal bei allen ${x.answered} Trades in Ordnung.`, cls: 'pos' };
    const prev = J.weekId(J.addDays(from, -7)), next = J.weekId(J.addDays(from, 7));
    const past = [...J.store.reviews].sort((a, b) => b.id.localeCompare(a.id)).slice(0, 12);
    async function save() {
      await J.api.save('reviews', m);
      J.toast('Review gespeichert ✓');
      J.render();
    }
    let phase = null;
    J.clear(main).append(J.page(`Wochen-Review KW ${weekId.split('-W')[1]} · ${J.fmtShort(from)} – ${J.fmtShort(to)}${to.slice(0, 4)}`,
      [J.btn('‹', () => J.go('#/review/' + prev), 'ghost'), J.btn('›', () => J.go('#/review/' + next), 'ghost')],
      h('p.muted', 'Regel 10: Jeden Samstag Journal auswerten. Geh jede Regel und jede Frage für die ganze Woche durch – die Hinweise zeigen, was dein Journal dazu sagt.'),
      J.card('Zahlen der Woche', J.summaryTable(from, to)),
      J.card('Trades der Woche', J.tradeTable(trades.slice().reverse())),
      J.lockable(
        J.card('1 · Habe ich meine Regeln eingehalten?', S.ruleTexts.map((r, i) => {
          const n = i + 1, c = ruleCount(trades, n);
          const hint = n === 10 ? null : n === 7 || !trades.length ? null
            : c ? { text: `Laut Journal ${c}× gebrochen diese Woche.`, cls: 'neg' } : { text: 'Laut Journal nicht gebrochen.', cls: 'pos' };
          return questionBlock(`Regel ${n}`, r, m.rules[n], KEPT, hint, 'Warum habe ich die Regel gebrochen bzw. eingehalten? Was ändere ich?');
        })),
        J.card('2 · War meine Ausführung richtig?', S.executionQuestions.map(q => {
          m.execution[q.id] = m.execution[q.id] || {};
          return questionBlock(null, q.text, m.execution[q.id], J.YNP, statHint(execBad[q.id], q.invert ? 'mit „Ja“ beantwortet' : 'nicht in Ordnung'));
        })),
        J.card('3 · Habe ich meine Emotionen kontrolliert?', S.emotionQuestions.map(q => {
          m.emotions[q.id] = m.emotions[q.id] || {};
          const head = q.phase && q.phase !== phase ? h('div.qphase', (phase = q.phase)) : null;
          return [head, questionBlock(null, q.text, m.emotions[q.id], J.YNP, statHint(emoBad[q.id], 'mit „Ja“ beantwortet'))];
        })),
        J.card('4 · Bewertung der Woche', S.reflectionQuestions.map(q => J.field(q.text, J.txt(m.reflection, q.id, { rows: 4 })))),
        J.card('5 · Ausblick & Feedback', S.reviewQuestions.map(q => J.field(q.text, J.txt(m.answers, q.id, { rows: 4 }))),
          h('div.grid4',
            J.field('Zufriedenheit mit der Woche', J.seg(m, 'rating', [['1', '1'], ['2', '2'], ['3', '3'], ['4', '4'], ['5', '5']])),
            J.field('Status', J.chk(m, 'done', 'Review erledigt (Regel 10)'))))),
      J.saveBar(save),
      past.length ? J.card('Frühere Reviews', h('div.chips', past.map(r => J.link(`KW ${r.id.split('-W')[1]}/${r.id.slice(0, 4)} ${r.done ? '✓' : ''}`, '#/review/' + r.id, 'chip')))) : null,
    ));
  };

  // ---------- Regeln: Regel-Check vor dem Trade + Übersicht ----------
  const RC = { account: null, market: null, time: '', aplus: false, r3: {}, r4: {}, r5: {} };
  J.renderRules = (main) => {
    const S = J.store.settings;
    RC.account = RC.account || (S.accounts[1] || S.accounts[0]).id;
    RC.market = RC.market || S.markets[0].id;
    RC.time = RC.time || J.nowLocal();
    const checkBox = h('div');
    let news = [];

    const undocumented = () => J.store.trades.filter(t => {
      const c = J.calc(t);
      const sc = J.checklistScore(t.checklist);
      return !sc.answered || (c.closed && !Object.values(t.execution || {}).some(x => x && x.v));
    });
    const reviewStatus = () => {
      const today = J.today(), wd = J.parse(today).getDay();
      const due = wd === 6 || wd === 0 ? J.weekId(today) : J.weekId(J.addDays(today, -7));
      const rv = J.byId(J.store.reviews, due);
      return { due, done: !!(rv && rv.done) };
    };

    const drawCheck = () => {
      const acc = J.account(RC.account);
      const auto = J.checkRules({ id: '_check', account: RC.account, market: RC.market, entryTime: RC.time, aplus: RC.aplus, sl: 1, checklist: {} }, news);
      const byN = Object.fromEntries(auto.map(r => [r.n, r]));
      const manual = (store, okText, failText) => !store.v ? { status: 'open', detail: 'Bitte beantworten' }
        : store.v === 'yes' ? { status: 'ok', detail: okText } : { status: 'fail', detail: failText };
      const undoc = undocumented(), rv = reviewStatus();
      const rows = S.ruleTexts.map((text, i) => {
        const n = i + 1;
        let st, ask = null;
        if (n === 3) { st = manual(RC.r3, 'Checkliste erfüllt', 'Checkliste unter 70 % – kein Trade'); ask = ['Sind mindestens 70 % der Signifikanz-Checkliste erfüllt?', RC.r3]; }
        else if (n === 4) { st = manual(RC.r4, 'Stop-Loss steht', 'Ohne Stop-Loss kein Trade'); ask = ['Ist der Stop-Loss vorher definiert – und vergrößere ich ihn niemals?', RC.r4]; }
        else if (n === 5) { st = manual(RC.r5, 'Risiko passt', 'Risiko zu hoch'); ask = [`Ist das Risiko höchstens ${J.num(acc.riskPct, 2)} % (${acc.name})?`, RC.r5]; }
        else if (n === 7) st = undoc.length ? { status: 'warn', detail: `${undoc.length} Trade(s) noch nicht vollständig dokumentiert` } : { status: 'ok', detail: 'Alle Trades dokumentiert' };
        else if (n === 10) st = rv.done ? { status: 'ok', detail: `Review KW ${rv.due.split('-W')[1]} erledigt` } : { status: 'warn', detail: `Review KW ${rv.due.split('-W')[1]} noch offen` };
        else st = byN[n] ? { status: byN[n].status, detail: byN[n].detail } : { status: 'ok', detail: '' };
        return { n, text, ...st, ask };
      });
      const fails = rows.filter(r => r.status === 'fail'), open = rows.filter(r => r.status === 'open');
      const verdict = fails.length ? { cls: 'neg', text: `✗ Kein Trade – ${fails.map(r => 'Regel ' + r.n).join(', ')} verletzt.` }
        : open.length ? { cls: 'warn', text: `Noch ${open.length} Frage(n) offen.` }
        : { cls: 'pos', text: '✓ Laut deinen Regeln darfst du den Trade eingehen.' };
      J.clear(checkBox).append(
        h('ul.rules.rules-check', rows.map(r => h('li', { class: r.status === 'open' ? 'warn' : r.status },
          h('span.ri', { ok: '✓', warn: '!', fail: '✗', open: '?', na: '·' }[r.status]),
          h('div.rc-body',
            h('div', h('b', `Regel ${r.n} `), h('span', r.text)),
            r.ask ? h('div.rc-ask', h('span', r.ask[0]), J.seg(r.ask[1], 'v', [['yes', 'Ja', 'y'], ['no', 'Nein', 'n']], drawCheck)) : null,
            h('div.rd', r.detail),
            r.n === 7 && undoc.length ? h('div.chips', undoc.slice(0, 6).map(t => J.link(`${t.market} ${J.fmtShort(t.entryTime)}`, '#/trade/' + t.id, 'chip'))) : null,
            r.n === 10 && !rv.done ? J.link('Review öffnen →', '#/review/' + rv.due) : null)))),
        h('div', { class: 'verdict ' + verdict.cls }, verdict.text),
        fails.length || open.length ? null : J.btn('Trade erfassen →', () => J.go(`#/trade/neu?market=${RC.market}&account=${RC.account}&time=${encodeURIComponent(RC.time)}&rulesok=1${RC.aplus ? '&aplus=1' : ''}`), 'primary'));
    };
    const refresh = async () => { news = await J.dayNews(RC.time.slice(0, 10)); drawCheck(); };

    const all = J.ruleViolationCounts(J.store.trades);
    const month = J.ruleViolationCounts(J.filterTrades(J.monthRange(J.today())));
    const week = J.ruleViolationCounts(J.filterTrades(J.weekRange(J.today())));
    const cnt = (list, n) => (list.find(x => x.n === n) || { c: 0 }).c;
    const lastViol = J.store.trades.filter(t => (t.violations || []).length).sort((a, b) => b.entryTime.localeCompare(a.entryTime)).slice(0, 10);

    J.clear(main).append(J.page('Kompromisslose Regeln', null,
      J.card('Regel-Check: Darf ich den Trade laut meinen Regeln überhaupt eingehen?',
        h('p.muted', 'Vor jedem Trade durchgehen. Regel 1, 2, 6, 8 und 9 prüft das Journal automatisch, Regel 3, 4 und 5 beantwortest du.'),
        J.lockable(h('div.grid4',
          J.field('Konto', J.sel(RC, 'account', S.accounts.map(a => [a.id, a.name]), drawCheck)),
          J.field('Markt', J.sel(RC, 'market', S.markets.map(x => [x.id, x.name]), refresh)),
          J.field('Geplanter Einstieg', J.inp(RC, 'time', { type: 'datetime-local' }, refresh)),
          J.field('A+ Setup', J.chk(RC, 'aplus', 'Ausnahme für Regel 1 & 2', drawCheck))),
        checkBox)),
      J.card('Verstöße je Regel', h('table.list',
        h('thead', h('tr', h('th', '#'), h('th', 'Regel'), h('th', 'Diese Woche'), h('th', 'Diesen Monat'), h('th', 'Gesamt'))),
        h('tbody', S.ruleTexts.map((r, i) => h('tr', h('td', h('b', i + 1)), h('td.wrap', r),
          h('td', { class: cnt(week, i + 1) ? 'neg' : 'pos' }, cnt(week, i + 1)),
          h('td', { class: cnt(month, i + 1) ? 'neg' : 'pos' }, cnt(month, i + 1)), h('td', cnt(all, i + 1))))))),
      lastViol.length ? J.card('Letzte Regelverstöße', h('ul.toplist', lastViol.map(t => h('li',
        J.link(`${J.fmtDateTime(t.entryTime)} · ${t.market}`, '#/trade/' + t.id), ' – ', t.violations.map(n => 'Regel ' + n).join(', '))))) : null,
    ));
    refresh();
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
